require('dotenv').config();
const fs = require('fs');
const { SerialPort } = require('serialport');
const { execSync } = require('child_process');
const ThermalPrinter = require('node-thermal-printer').printer;
const PrinterTypes = require('node-thermal-printer').types;

// --- Validação de dependências e .env ---
function checkDependencies() {
  try {
    require.resolve('dotenv');
    require.resolve('serialport');
    require.resolve('node-thermal-printer');
  } catch (err) {
    console.error('❌ Dependências não instaladas. Execute: npm install dotenv serialport node-thermal-printer');
    process.exit(1);
  }
  if (!fs.existsSync('.env')) {
    console.error('❌ Arquivo .env não encontrado! Crie um baseado no exemplo fornecido.');
    process.exit(1);
  }
}

// --- Classe Principal ---
class SimplePrinter {
  constructor() {
    checkDependencies();
    this.printer = null;
    this.isConnected = false;
    this.init()
      .then(() => {
        if (!this.isConnected) {
          console.error('\n❌ Nenhuma impressora pronta!\nVerifique o cabo USB, IP, drivers Windows, e as configurações do .env.');
        }
      });
  }

  async init() {
    const printerMode = (process.env.PRINTER_MODE || 'usb').toLowerCase();
    if (printerMode === 'usb') {
      const printerPort = process.env.PRINTER_PORT;
      if (printerPort) {
        await this.tryUsbPort(printerPort);
      } else {
        await this.scanAllUsbPorts();
      }
    } else if (printerMode === 'network') {
      await this.tryNetworkPrinter();
    } else if (printerMode === 'windows') {
      await this.tryWindowsPrinter();
    } else {
      console.error('❌ PRINTER_MODE inválido! Use "usb", "network" ou "windows" no .env');
    }
  }

  async tryUsbPort(portName) {
    try {
      const printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: portName,
        width: 48,
        characterSet: 'PC850_MULTILINGUAL',
        removeSpecialCharacters: false,
      });
      const connected = await printer.isPrinterConnected();
      if (connected) {
        this.printer = printer;
        this.isConnected = true;
        console.log(`✅ Impressora encontrada na porta ${portName}`);
        await this.printTest();
      } else {
        throw new Error(`Impressora não encontrada em ${portName}`);
      }
    } catch (err) {
      console.error(`❌ Falha ao conectar na porta ${portName}:`, err.message);
      this.printer = null;
      this.isConnected = false;
    }
  }

  async scanAllUsbPorts() {
    try {
      const ports = await SerialPort.list();
      if (ports.length === 0) {
        console.error('❌ Nenhuma porta serial (COM) detectada no sistema!');
        return;
      }
      const portNames = ports.map(port => port.path);
      console.log('🔎 Portas COM detectadas:', portNames);
      for (const portName of portNames) {
        await this.tryUsbPort(portName);
        if (this.isConnected) break;
      }
      if (!this.isConnected) {
        console.error('❌ Nenhuma impressora encontrada nas portas USB.');
      }
    } catch (error) {
      console.error('❌ Erro ao listar portas seriais:', error.message);
    }
  }

  async tryNetworkPrinter() {
    const ip = process.env.PRINTER_IP;
    const port = process.env.PRINTER_IP_PORT || 9100;
    if (!ip) {
      console.error('❌ PRINTER_IP não definido no .env');
      return;
    }
    const interfaceString = `tcp://${ip}:${port}`;
    try {
      const printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: interfaceString,
        width: 48,
        characterSet: 'PC850_MULTILINGUAL',
        removeSpecialCharacters: false,
      });
      const connected = await printer.isPrinterConnected();
      if (connected) {
        this.printer = printer;
        this.isConnected = true;
        console.log(`✅ Impressora de rede encontrada em ${interfaceString}`);
        await this.printTest();
      } else {
        throw new Error(`Impressora não conectada em ${interfaceString}`);
      }
    } catch (err) {
      console.error(`❌ Falha ao conectar na impressora de rede:`, err.message);
      this.printer = null;
      this.isConnected = false;
    }
  }

  async tryWindowsPrinter() {
    const printerName = process.env.PRINTER_NAME;
    
    if (printerName) {
      // Tentar conectar na impressora especificada
      await this.connectToWindowsPrinter(printerName);
    } else {
      // Buscar automaticamente por impressoras disponíveis
      await this.scanWindowsPrinters();
    }
  }

  async getWindowsPrinters() {
    try {
      console.log('🔎 Listando impressoras do Windows...');
      // Usar wmic para listar impressoras do Windows
      const output = execSync('wmic printer get name', { encoding: 'utf8', timeout: 10000 });
      const lines = output.split('\n').map(line => line.trim()).filter(line => line && line !== 'Name');
      
      console.log('📋 Impressoras encontradas:', lines);
      return lines;
    } catch (error) {
      console.error('❌ Erro ao listar impressoras do Windows:', error.message);
      return [];
    }
  }

  async findCompatiblePrinters(printers) {
    // Procurar por impressoras que contenham padrões comuns de impressoras térmicas
    const patterns = ['EPSON', 'TM-', 'TM20', 'TM-T20', 'Receipt', 'Thermal'];
    const compatible = [];

    for (const printer of printers) {
      const upperPrinter = printer.toUpperCase();
      for (const pattern of patterns) {
        if (upperPrinter.includes(pattern.toUpperCase())) {
          compatible.push(printer);
          break;
        }
      }
    }

    return compatible;
  }

  async connectToWindowsPrinter(printerName) {
    try {
      const interfaceString = `printer:${printerName}`;
      console.log(`🔌 Tentando conectar na impressora Windows: ${printerName}`);
      
      const printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: interfaceString,
        width: 48,
        characterSet: 'PC850_MULTILINGUAL',
        removeSpecialCharacters: false,
      });

      const connected = await printer.isPrinterConnected();
      if (connected) {
        this.printer = printer;
        this.isConnected = true;
        console.log(`✅ Impressora Windows encontrada: ${printerName}`);
        await this.printTest();
      } else {
        throw new Error(`Impressora não conectada: ${printerName}`);
      }
    } catch (err) {
      console.error(`❌ Falha ao conectar na impressora Windows "${printerName}":`, err.message);
      this.printer = null;
      this.isConnected = false;
    }
  }

  async scanWindowsPrinters() {
    try {
      const printers = await this.getWindowsPrinters();
      
      if (printers.length === 0) {
        console.error('❌ Nenhuma impressora Windows detectada!');
        return;
      }

      // Primeiro, tentar impressoras compatíveis conhecidas
      const compatiblePrinters = await this.findCompatiblePrinters(printers);
      
      if (compatiblePrinters.length > 0) {
        console.log('🎯 Impressoras compatíveis encontradas:', compatiblePrinters);
        
        for (const printerName of compatiblePrinters) {
          await this.connectToWindowsPrinter(printerName);
          if (this.isConnected) break;
        }
      }

      // Se nenhuma impressora compatível funcionou, tentar todas as outras
      if (!this.isConnected) {
        console.log('🔄 Tentando outras impressoras disponíveis...');
        
        for (const printerName of printers) {
          if (!compatiblePrinters.includes(printerName)) {
            await this.connectToWindowsPrinter(printerName);
            if (this.isConnected) break;
          }
        }
      }

      if (!this.isConnected) {
        console.error('❌ Nenhuma impressora Windows compatível encontrada.');
        console.log('💡 Dica: Defina PRINTER_NAME no .env com o nome exato da impressora.');
      }
    } catch (error) {
      console.error('❌ Erro ao escanear impressoras Windows:', error.message);
    }
  }

  // Teste imediato após conexão
  async printTest() {
    if (!this.printer) return;
    this.printer.clear();
    this.printer.setTextSize(1, 1);
    this.printer.alignCenter();
    this.printer.println('*** TESTE DE IMPRESSÃO ***');
    this.printer.println(new Date().toLocaleString('pt-BR'));
    this.printer.cut();
    try {
      await this.printer.execute();
      console.log('🖨️ Teste de impressão enviado com sucesso.');
    } catch (err) {
      console.error('❌ Falha ao imprimir o teste:', err.message);
    }
  }

  // Método de impressão de senha/token exemplo
  async printTokenNumber(token) {
    if (!this.printer || !this.isConnected) {
      console.error('❌ Impressora não conectada.');
      return false;
    }
    this.printer.clear();
    this.printer.setTextSize(2, 2);
    this.printer.alignCenter();
    this.printer.println(`Senha: ${token}`);
    this.printer.cut();
    try {
      await this.printer.execute();
      console.log('🖨️ Senha impressa com sucesso.');
      return true;
    } catch (err) {
      console.error('❌ Erro ao imprimir senha:', err.message);
      return false;
    }
  }
}

module.exports = SimplePrinter;