$ErrorActionPreference = "Stop"

$Host.UI.RawUI.WindowTitle = "NextCRM - Puente de Impresion"
$Port = 18181
$Address = [System.Net.IPAddress]::Loopback

Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Runtime.InteropServices;

public class NextCrmRawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
  public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
  }

  [DllImport("winspool.drv", SetLastError=true, CharSet=CharSet.Ansi)]
  static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

  [DllImport("winspool.drv", SetLastError=true)]
  static extern bool ClosePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", SetLastError=true, CharSet=CharSet.Ansi)]
  static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In] DOCINFOA di);

  [DllImport("winspool.drv", SetLastError=true)]
  static extern bool EndDocPrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", SetLastError=true)]
  static extern bool StartPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", SetLastError=true)]
  static extern bool EndPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", SetLastError=true)]
  static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

  public static bool SendBytes(string printerName, byte[] bytes) {
    IntPtr hPrinter = IntPtr.Zero;
    IntPtr unmanaged = IntPtr.Zero;
    try {
      if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) return false;
      var di = new DOCINFOA();
      di.pDocName = "NextCRM Ticket";
      di.pDataType = "RAW";
      if (!StartDocPrinter(hPrinter, 1, di)) return false;
      if (!StartPagePrinter(hPrinter)) return false;
      unmanaged = Marshal.AllocCoTaskMem(bytes.Length);
      Marshal.Copy(bytes, 0, unmanaged, bytes.Length);
      int written;
      bool ok = WritePrinter(hPrinter, unmanaged, bytes.Length, out written);
      EndPagePrinter(hPrinter);
      EndDocPrinter(hPrinter);
      return ok && written == bytes.Length;
    } finally {
      if (unmanaged != IntPtr.Zero) Marshal.FreeCoTaskMem(unmanaged);
      if (hPrinter != IntPtr.Zero) ClosePrinter(hPrinter);
    }
  }
}
'@

function Clean-Text([object]$Value) {
  if ($null -eq $Value) { return "" }
  $s = [string]$Value
  $normalized = $s.Normalize([Text.NormalizationForm]::FormD)
  $sb = New-Object Text.StringBuilder
  foreach ($ch in $normalized.ToCharArray()) {
    $cat = [Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch)
    if ($cat -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
      [void]$sb.Append($ch)
    }
  }
  return ($sb.ToString() -replace '[^\x20-\x7E\r\n]', '')
}

function Center-Text([string]$Text, [int]$Width = 48) {
  $clean = Clean-Text $Text
  if ($clean.Length -gt $Width) { $clean = $clean.Substring(0, $Width) }
  $left = [Math]::Max(0, [Math]::Floor(($Width - $clean.Length) / 2))
  return (" " * $left) + $clean
}

function Two-Cols([string]$Left, [string]$Right, [int]$Width = 48) {
  $l = Clean-Text $Left
  $r = Clean-Text $Right
  $gap = [Math]::Max(1, $Width - $l.Length - $r.Length)
  $line = $l + (" " * $gap) + $r
  if ($line.Length -gt $Width) { $line = $line.Substring(0, $Width) }
  return $line
}

function Build-Ticket([object]$Order, [string]$CopyLabel) {
  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add((Center-Text "EL ARBOL"))
  $lines.Add((Center-Text "PIZZERIA"))
  $lines.Add((Center-Text $CopyLabel))
  $lines.Add(("=" * 48))

  $type = (Clean-Text $Order.type).ToUpperInvariant()
  if ([string]::IsNullOrWhiteSpace($type)) { $type = "LOCAL" }
  if ($type -eq "MESA") { $type = "PEDIDO DE MESA" }
  $lines.Add((Center-Text $type))
  $lines.Add((Center-Text ("TICKET " + (Clean-Text $Order.id))))

  if ($Order.reference) { $lines.Add((Center-Text $Order.reference)) }
  if ($Order.client -and $Order.client.name) { $lines.Add((Two-Cols "CLIENTE" $Order.client.name)) }
  if ($Order.assignedWaiter) { $lines.Add((Two-Cols "MOZA/O" $Order.assignedWaiter)) }
  if ($Order.time) { $lines.Add((Two-Cols "HORA" $Order.time)) }

  $lines.Add(("-" * 48))
  foreach ($item in @($Order.items)) {
    $qty = 1
    if ($item.quantity) { $qty = [int]$item.quantity }
    $name = Clean-Text $item.name
    $unit = 0
    if ($item.finalPrice) { $unit = [double]$item.finalPrice }
    elseif ($item.price) { $unit = [double]$item.price }
    $total = [Math]::Round($unit * $qty)
    $lines.Add((Two-Cols ("$qty" + "x " + $name) ("$" + [int]$total)))

    foreach ($t in @($item.selectedToppings)) {
      if ($t -and $t.name) { $lines.Add(("  + " + (Clean-Text $t.name))) }
    }
  }

  if ($Order.notes) {
    $lines.Add(("-" * 48))
    $lines.Add(("OBS: " + (Clean-Text $Order.notes)))
  }

  $lines.Add(("=" * 48))
  $totalOrder = 0
  if ($Order.total) { $totalOrder = [Math]::Round([double]$Order.total) }
  $lines.Add((Two-Cols "TOTAL" ("$" + [int]$totalOrder)))
  if ($Order.paymentMethod) { $lines.Add((Two-Cols "PAGO" $Order.paymentMethod)) }
  $lines.Add("")
  $lines.Add((Center-Text "*** FIN DE COMANDA ***"))
  $lines.Add("")
  $lines.Add("")
  $lines.Add("")

  return [Text.Encoding]::ASCII.GetBytes(($lines -join "
"))
}

function Send-ToPrinter([string]$PrinterName, [byte[]]$Bytes) {
  if ([string]::IsNullOrWhiteSpace($PrinterName)) { throw "Falta seleccionar la impresora de Windows." }
  $ok = [NextCrmRawPrinter]::SendBytes($PrinterName, $Bytes)
  if (-not $ok) { throw "Windows no pudo enviar el ticket a la impresora seleccionada." }
}

function Send-JsonResponse($Stream, [int]$StatusCode, [object]$Payload) {
  $json = $Payload | ConvertTo-Json -Depth 10 -Compress
  $body = [Text.Encoding]::UTF8.GetBytes($json)
  $statusText = if ($StatusCode -eq 200) { "OK" } elseif ($StatusCode -eq 204) { "No Content" } elseif ($StatusCode -eq 400) { "Bad Request" } else { "Server Error" }
  $headers = "HTTP/1.1 $StatusCode $statusText`r`n" +
             "Content-Type: application/json; charset=utf-8`r`n" +
             "Content-Length: $($body.Length)`r`n" +
             "Access-Control-Allow-Origin: *`r`n" +
             "Access-Control-Allow-Headers: Content-Type, X-Printer-Token`r`n" +
             "Access-Control-Allow-Methods: GET, POST, OPTIONS`r`n" +
             "Access-Control-Allow-Private-Network: true`r`n" +
             "Connection: close`r`n`r`n"
  $headerBytes = [Text.Encoding]::ASCII.GetBytes($headers)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($StatusCode -ne 204) { $Stream.Write($body, 0, $body.Length) }
  $Stream.Flush()
}

function Read-Request($Stream) {
  $reader = New-Object IO.StreamReader($Stream, [Text.Encoding]::UTF8, $false, 1024, $true)
  $requestLine = $reader.ReadLine()
  if ([string]::IsNullOrWhiteSpace($requestLine)) { return $null }

  $headers = @{}
  while ($true) {
    $line = $reader.ReadLine()
    if ($null -eq $line -or $line -eq "") { break }
    $idx = $line.IndexOf(":")
    if ($idx -gt 0) {
      $headers[$line.Substring(0, $idx).Trim().ToLowerInvariant()] = $line.Substring($idx + 1).Trim()
    }
  }

  $parts = $requestLine.Split(" ")
  $method = $parts[0].ToUpperInvariant()
  $path = $parts[1]
  $body = ""
  $contentLength = 0
  if ($headers.ContainsKey("content-length")) { [int]::TryParse($headers["content-length"], [ref]$contentLength) | Out-Null }
  if ($contentLength -gt 0) {
    $buffer = New-Object char[] $contentLength
    $read = 0
    while ($read -lt $contentLength) {
      $n = $reader.Read($buffer, $read, $contentLength - $read)
      if ($n -le 0) { break }
      $read += $n
    }
    $body = -join $buffer[0..([Math]::Max(0, $read - 1))]
  }

  return [pscustomobject]@{ Method = $method; Path = $path; Headers = $headers; Body = $body }
}

$listener = New-Object Net.Sockets.TcpListener($Address, $Port)
try {
  $listener.Start()
} catch {
  Write-Host ""
  Write-Host "No se pudo iniciar el puente en el puerto $Port." -ForegroundColor Red
  Write-Host "Puede que ya este abierto en otra ventana." -ForegroundColor Yellow
  Write-Host $_.Exception.Message
  Read-Host "Presione ENTER para cerrar"
  exit 1
}

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " NEXTCRM - PUENTE DE IMPRESION ACTIVO" -ForegroundColor Green
Write-Host " http://127.0.0.1:$Port" -ForegroundColor White
Write-Host " No cierre esta ventana mientras use el POS." -ForegroundColor Yellow
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

while ($true) {
  $client = $null
  try {
    $client = $listener.AcceptTcpClient()
    $client.ReceiveTimeout = 10000
    $client.SendTimeout = 10000
    $stream = $client.GetStream()
    $request = Read-Request $stream
    if ($null -eq $request) { continue }

    if ($request.Method -eq "OPTIONS") {
      Send-JsonResponse $stream 204 @{}
      continue
    }

    if ($request.Method -eq "GET" -and $request.Path -eq "/health") {
      Send-JsonResponse $stream 200 @{ ok = $true; bridge = "NextCRM Windows Printer Bridge"; port = $Port; platform = "win32" }
      continue
    }

    if ($request.Method -eq "GET" -and $request.Path -eq "/windows-printers") {
      $items = @(Get-CimInstance Win32_Printer | Select-Object Name, Default, WorkOffline, PrinterStatus)
      Send-JsonResponse $stream 200 @{ ok = $true; printers = $items }
      continue
    }

    if ($request.Method -eq "POST" -and ($request.Path -eq "/test-windows" -or $request.Path -eq "/print-windows")) {
      $data = $request.Body | ConvertFrom-Json
      $printerName = [string]$data.printerName
      if ([string]::IsNullOrWhiteSpace($printerName)) {
        Send-JsonResponse $stream 400 @{ ok = $false; error = "Selecciona una impresora de Windows." }
        continue
      }

      if ($request.Path -eq "/test-windows") {
        $testOrder = [pscustomobject]@{
          id = "#TEST"
          type = "Local"
          reference = "PRUEBA IMPRESORA ANTERIOR"
          client = [pscustomobject]@{ name = "PRUEBA NEXTCRM" }
          time = (Get-Date).ToString("HH:mm")
          items = @([pscustomobject]@{ name = "PRUEBA DE IMPRESION"; quantity = 1; finalPrice = 0; selectedToppings = @() })
          total = 0
          paymentMethod = "PRUEBA"
          notes = "Texto limpio Windows OK"
        }
        Send-ToPrinter $printerName (Build-Ticket $testOrder "PRUEBA IMPRESORA ANTERIOR")
        Send-JsonResponse $stream 200 @{ ok = $true; printerName = $printerName }
        continue
      }

      $order = $data.order
      if ($null -eq $order -or $null -eq $order.items) {
        Send-JsonResponse $stream 400 @{ ok = $false; error = "Pedido invalido." }
        continue
      }

      $copies = 2
      if ($data.copies) { $copies = [Math]::Min(4, [Math]::Max(1, [int]$data.copies)) }
      $all = New-Object System.Collections.Generic.List[byte]
      for ($i = 0; $i -lt $copies; $i++) {
        $label = if ($copies -gt 1) { if ($i -eq 0) { "VIA COCINA" } else { "VIA CONTROL" } } else { "COMANDA" }
        foreach ($b in (Build-Ticket $order $label)) { $all.Add($b) }
        foreach ($b in [Text.Encoding]::ASCII.GetBytes("


")) { $all.Add($b) }
      }
      Send-ToPrinter $printerName ($all.ToArray())
      Send-JsonResponse $stream 200 @{ ok = $true; printerName = $printerName; copies = $copies; ticketId = $order.id }
      continue
    }

    Send-JsonResponse $stream 400 @{ ok = $false; error = "Ruta no soportada." }
  } catch {
    try {
      if ($client -and $client.Connected) {
        Send-JsonResponse $client.GetStream() 500 @{ ok = $false; error = $_.Exception.Message }
      }
    } catch {}
    Write-Host ("Error: " + $_.Exception.Message) -ForegroundColor Red
  } finally {
    if ($client) { $client.Close() }
  }
}
