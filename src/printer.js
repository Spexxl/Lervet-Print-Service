const { ThermalPrinter, PrinterTypes } = require('node-thermal-printer');

class SimplePrinter {
  constructor() {
    this.printer = null;
    this.isConnected = false;
    this.init();
  }

  init() {
    try {
      this.printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: 'COM3',               // Padrão, cliente pode mudar para COM1, COM2, etc.
        width: 48,
        characterSet: 'PC850_MULTILINGUAL', // Charset mais compatível
        removeSpecialCharacters: false,
      });
      
      console.log('🖨️ Impressora inicializada');
      this.testConnection();
    } catch (error) {
      console.error('❌ Erro ao inicializar impressora:', error.message);
      console.log('💡 Isso é normal se a impressora não estiver conectada');
      this.printer = null;
    }
  }

  async testConnection() {
    try {
      if (!this.printer) {
        console.log('⚠️ Impressora não inicializada - aguardando conexão física');
        return;
      }
      
      this.isConnected = await this.printer.isPrinterConnected();
      if (this.isConnected) {
        console.log('✅ Impressora TM-TX20 conectada');
        await this.printTest();
      } else {
        console.log('⚠️ Impressora não encontrada na COM3');
        console.log('💡 Verifique: 1) Impressora ligada 2) Cabo USB 3) Driver instalado');
      }
    } catch (error) {
      console.error('❌ Erro ao testar conexão:', error.message);
      this.isConnected = false;
    }
  }

  async printTest() {
    try {
      this.printer.clear();
      this.printer.alignCenter();
      this.printer.bold(true);
      this.printer.println('TESTE IMPRESSORA');
      this.printer.bold(false);
      this.printer.println('Funcionando OK!');
      this.printer.newLine();
      this.printer.cut();
      
      await this.printer.execute();
      console.log('✅ Teste de impressão realizado');
    } catch (error) {
      console.error('❌ Erro no teste:', error.message);
    }
  }

  async printTokenNumber(numero) {
    try {
      if (!this.printer) {
        console.log('❌ Impressora não inicializada');
        return false;
      }

      if (!this.isConnected) {
        console.log('⚠️ Tentando reconectar impressora...');
        await this.testConnection();
      }

      if (!this.isConnected) {
        console.log('❌ Impressora não conectada - token não impresso');
        return false;
      }

      this.printer.clear();
      this.printer.alignCenter();
      this.printer.setTextQuadArea();
      this.printer.bold(true);
      this.printer.println(`TOKEN`);
      this.printer.setTextSize(3, 3);
      this.printer.println(`${numero}`);
      this.printer.bold(false);
      this.printer.setTextNormal();
      
      this.printer.newLine();
      this.printer.setTextSize(0, 0);
      const agora = new Date();
      this.printer.println(agora.toLocaleDateString('pt-BR'));
      this.printer.println(agora.toLocaleTimeString('pt-BR'));
      
      this.printer.newLine();
      this.printer.newLine();
      this.printer.cut();
      
      await this.printer.execute();
      
      console.log(`✅ TOKEN ${numero} IMPRESSO`);
      return true;
      
    } catch (error) {
      console.error(`❌ Erro ao imprimir token ${numero}:`, error.message);
      return false;
    }
  }
}

module.exports = SimplePrinter;