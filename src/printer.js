require('dotenv').config();
const fs = require('fs');
const { SerialPort } = require('serialport');
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
          console.error('\n❌ Nenhuma impressora pronta!\nVerifique o cabo USB, IP, drivers, e as configurações do .env.');
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
    } else {
      console.error('❌ PRINTER_MODE inválido! Use "usb" ou "network" no .env');
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
      return;
    }
    this.printer.clear();
    this.printer.setTextSize(2, 2);
    this.printer.alignCenter();
    this.printer.println(`Senha: ${token}`);
    this.printer.cut();
    try {
      await this.printer.execute();
      console.log('🖨️ Senha impressa com sucesso.');
    } catch (err) {
      console.error('❌ Erro ao imprimir senha:', err.message);
    }
  }
}

module.exports = SimplePrinter;