# Marca las carpetas generadas para que Dropbox no las sincronice.
# Ejecutar desde la raíz del repositorio, antes de `npm install`.
$carpetas = @(
  'node_modules',
  'apps/web/node_modules',
  'apps/api/node_modules',
  'packages/shared/node_modules',
  'apps/web/dist',
  'apps/api/dist',
  'packages/shared/dist'
)
foreach ($c in $carpetas) {
  New-Item -ItemType Directory -Force -Path $c | Out-Null
  Set-Content -Path $c -Stream com.dropbox.ignored -Value 1
}
Write-Host "Carpetas marcadas para que Dropbox las ignore."
