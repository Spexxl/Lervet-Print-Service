# Suporte a Windows Printer API

## Nova Funcionalidade: PRINTER_MODE=windows

A partir desta versão, o serviço suporta conexão com impressoras que estão instaladas e reconhecidas pelo Windows, mas não estão disponíveis como portas COM.

### Configuração

#### Modo 1: Impressora Específica
```
PRINTER_MODE=windows
PRINTER_NAME=EPSON TM-T20X Receipt
```

#### Modo 2: Detecção Automática
```
PRINTER_MODE=windows
# PRINTER_NAME não especificado - busca automática
```

### Como Descobrir o Nome da Impressora

Execute no Prompt de Comando (cmd) como Administrador:
```cmd
wmic printer get name
```

Exemplo de saída:
```
Name
EPSON TM-T20X Receipt
Microsoft Print to PDF
Microsoft XPS Document Writer
```

### Detecção Automática

Quando `PRINTER_NAME` não é especificado, o sistema procura automaticamente por impressoras que contenham os seguintes padrões:

- **EPSON** - Impressoras Epson
- **TM-** - Série TM (Thermal Model)
- **TM20**, **TM-T20** - Modelos específicos
- **Receipt** - Impressoras de recibo
- **Thermal** - Impressoras térmicas

O sistema tenta primeiro as impressoras compatíveis encontradas, e se nenhuma funcionar, tenta todas as outras impressoras disponíveis.

### Vantagens

1. **Sem necessidade de porta COM** - Funciona mesmo quando a impressora não aparece como porta serial
2. **Detecção automática inteligente** - Encontra automaticamente impressoras térmicas compatíveis
3. **Compatibilidade total** - Mantém todos os modos existentes (USB e Network)
4. **Fácil configuração** - Apenas uma linha no arquivo .env

### Solução de Problemas

1. **Verificar se a impressora está instalada**:
   - Abra "Impressoras e scanners" no Windows
   - Verifique se a impressora aparece na lista

2. **Verificar o nome exato**:
   - Use o comando `wmic printer get name`
   - O nome deve ser exatamente igual ao mostrado

3. **Testar primeiro com detecção automática**:
   - Configure apenas `PRINTER_MODE=windows`
   - Deixe o sistema encontrar a impressora automaticamente

4. **Verificar logs**:
   - O sistema mostra todas as impressoras encontradas
   - Mostra quais são consideradas compatíveis
   - Mostra tentativas de conexão

### Exemplo de Log Bem-sucedido

```
🔎 Listando impressoras do Windows...
📋 Impressoras encontradas: ['EPSON TM-T20X Receipt', 'Microsoft Print to PDF']
🎯 Impressoras compatíveis encontradas: ['EPSON TM-T20X Receipt']
🔌 Tentando conectar na impressora Windows: EPSON TM-T20X Receipt
✅ Impressora Windows encontrada: EPSON TM-T20X Receipt
🖨️ Teste de impressão enviado com sucesso.
```