@echo off
echo ========================================
echo   INSTALADOR SERVICO DE IMPRESSAO
echo ========================================

echo Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: Node.js nao encontrado!
    echo Baixe em: https://nodejs.org
    pause
    exit /b 1
)

echo Node.js encontrado!
echo.

echo Instalando dependencias...
npm install

if %errorlevel% neq 0 (
    echo ERRO: Falha ao instalar dependencias!
    pause
    exit /b 1
)

echo.
echo ========================================
echo   INSTALACAO CONCLUIDA!
echo ========================================
echo.
echo Para iniciar o servico, execute:
echo npm start
echo.
echo Certifique-se que:
echo 1. A impressora TM-TX20 esta ligada
echo 2. Cabo USB conectado OU impressora de rede configurada OU impressora Windows instalada
echo 3. Driver da impressora instalado
echo 4. Arquivo .env configurado corretamente
echo.
echo Modos de conexao suportados:
echo - USB/Serial (PRINTER_MODE=usb)
echo - Rede/TCP (PRINTER_MODE=network) 
echo - Windows Printer API (PRINTER_MODE=windows)
echo.
pause