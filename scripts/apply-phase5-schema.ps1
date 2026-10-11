$ErrorActionPreference = 'Stop'
$schemaPath = Join-Path $PSScriptRoot '..\prisma\schema.prisma'
$schemaPath = [System.IO.Path]::GetFullPath($schemaPath)
if (-not (Test-Path $schemaPath)) { throw "Cannot find prisma/schema.prisma at $schemaPath" }
$schema = [System.IO.File]::ReadAllText($schemaPath)
$start = $schema.IndexOf('model ConversationMember {')
if ($start -lt 0) { throw 'Could not find model ConversationMember in prisma/schema.prisma.' }
$nextModel = $schema.IndexOf("`nmodel Message {", $start)
if ($nextModel -lt 0) { throw 'Could not find model Message after ConversationMember.' }
$segment = $schema.Substring($start, $nextModel - $start)
if ($segment -notmatch '\bhiddenAt\s+DateTime\?') {
  $leftAtPattern = '([ \t]*leftAt[ \t]+DateTime\?[ \t]*\r?\n)'
  if ($segment -notmatch $leftAtPattern) { throw 'Could not find leftAt field to insert hiddenAt safely.' }
  $segment = [regex]::Replace($segment, $leftAtPattern, ('$1' + '  hiddenAt            DateTime?' + "`r`n"), 1)
}
if ($segment -notmatch '@@index\(\[userId,\s*hiddenAt\]\)') {
  $joinedIndexPattern = '([ \t]*@@index\(\[userId, *joinedAt\]\)[ \t]*\r?\n)'
  if ($segment -notmatch $joinedIndexPattern) { throw 'Could not find userId/joinedAt index to add the hiddenAt index safely.' }
  $segment = [regex]::Replace($segment, $joinedIndexPattern, ('$1' + '  @@index([userId, hiddenAt])' + "`r`n"), 1)
}
$schema = $schema.Substring(0, $start) + $segment + $schema.Substring($nextModel)
[System.IO.File]::WriteAllText($schemaPath, $schema, [System.Text.UTF8Encoding]::new($false))
Write-Host 'Phase 5 schema change applied. Review model ConversationMember, then run npx prisma format.' -ForegroundColor Green
