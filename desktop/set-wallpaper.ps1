param([Parameter(Mandatory=$true)][string]$ManifestPath, [switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
[StructLayout(LayoutKind.Sequential)] public struct MonitorRect { public int left, top, right, bottom; }
[ComImport, Guid("B92B56A9-8B55-4E14-9A89-0199BBB6F93B"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IWallpaper {
 void SetWallpaper([MarshalAs(UnmanagedType.LPWStr)] string monitorID, [MarshalAs(UnmanagedType.LPWStr)] string wallpaper);
 [return: MarshalAs(UnmanagedType.LPWStr)] string GetWallpaper([MarshalAs(UnmanagedType.LPWStr)] string monitorID);
 [return: MarshalAs(UnmanagedType.LPWStr)] string GetMonitorDevicePathAt(uint index);
 uint GetMonitorDevicePathCount();
 MonitorRect GetMonitorRECT([MarshalAs(UnmanagedType.LPWStr)] string monitorID);
}
public static class WallpaperAPI {
 public static IWallpaper Open() { return (IWallpaper)Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("C2CF3110-460E-4FC1-B9D0-8A1C0C9CC4BD"))); }
}
'@
if ($CheckOnly) { Write-Output 'Windows COM helper compiled'; exit 0 }
$items = @(Get-Content -LiteralPath $ManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json)
$api = [WallpaperAPI]::Open()
try {
 for ($i = 0; $i -lt $api.GetMonitorDevicePathCount(); $i++) {
  $id = $api.GetMonitorDevicePathAt($i)
  $rect = $api.GetMonitorRECT($id)
  $match = @($items | Where-Object { $_.x -eq $rect.left -and $_.y -eq $rect.top })
  if ($match.Count -ne 1) { throw "Cannot map Windows monitor $i to a generated image" }
  $file = [string]$match[0].path
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw 'Wallpaper file is missing' }
  $api.SetWallpaper($id, $file)
 }
} finally { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($api) }
