# Script para automatizar o commit e push para o GitHub (que ativará a Vercel)
# Executar no terminal: .\deploy.ps1

$RemoteUrl = "https://github.com/vitordevmm/sintonia360.git"
$Branch = "main"

Write-Host "Verificando se o Git está inicializado..." -ForegroundColor Cyan
$isGit = git rev-parse --is-inside-work-tree 2>&1
if ($isGit -match "fatal") {
    Write-Host "Inicializando repositório Git..." -ForegroundColor Yellow
    git init
}

Write-Host "Verificando/Adicionando a origem (remote)..." -ForegroundColor Cyan
$remoteExists = git remote -v | Select-String "origin"
if (!$remoteExists) {
    Write-Host "Adicionando remote origin: $RemoteUrl" -ForegroundColor Yellow
    git remote add origin $RemoteUrl
} else {
    Write-Host "Origem já configurada. Atualizando para garantir..." -ForegroundColor Yellow
    git remote set-url origin $RemoteUrl
}

Write-Host "Adicionando todos os arquivos modificados..." -ForegroundColor Cyan
git add .

Write-Host "Criando commit..." -ForegroundColor Cyan
$commitMessage = "Deploy update: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$name = git config user.name
if (!$name) {
    git config user.name "Sintonia360 Bot"
    git config user.email "bot@sintonia360.com"
}
git commit -m $commitMessage

Write-Host "Mudando para a branch $Branch..." -ForegroundColor Cyan
git branch -M $Branch

Write-Host "Enviando código para o GitHub (Isso disparará o build na Vercel se estiver conectada)..." -ForegroundColor Cyan
git push -u origin $Branch --force

Write-Host "✅ Feito! Código enviado para $RemoteUrl" -ForegroundColor Green
Write-Host "Se o seu repositório estiver vinculado na Vercel, o deploy automático já começou." -ForegroundColor Green
