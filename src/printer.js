require('dotenv').config();
const { SerialPort } = require('serialport');
const ThermalPrinter = require('node-thermal-printer').printer;
const PrinterTypes = require('node-thermal-printer').types;
const fs = require('fs');

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
    console.warn('⚠️ Arquivo .env não encontrado! Usando configurações padrão.');
  }
}

// --- Classe Principal Melhorada ---
class SimplePrinter {
  constructor() {
    checkDependencies();
    this.printer = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.lastWorkingPort = null;
  }

  async init() {
    console.log('🔍 Iniciando busca por impressoras...');
    const printerMode = (process.env.PRINTER_MODE || 'usb').toLowerCase();
    
    if (printerMode === 'usb') {
      const printerPort = process.env.PRINTER_PORT;
      if (printerPort) {
        console.log(`🎯 Tentando porta específica: ${printerPort}`);
        await this.tryUsbPort(printerPort);
      } else {
        console.log('🔎 Escaneando todas as portas USB...');
        await this.scanAllUsbPorts();
      }
    } else if (printerMode === 'network') {
      await this.tryNetworkPrinter();
    } else if (printerMode === 'tmusb') {
      await this.tryTmusbPrinter();
    }

    if (!this.isConnected) {
      console.error('\n❌ IMPRESSORA NÃO ENCONTRADA!');
      console.error('📋 Checklist de solução:');
      console.error('   1. Cabo USB conectado e funcionando');
      console.error('   2. Impressora ligada e com papel');
      console.error('   3. Drivers da impressora instalados');
      console.error('   4. Impressora não está sendo usada por outro programa');
      console.error('   5. Execute como Administrador (Windows) ou sudo (Linux/Mac)');
    }

    return this.isConnected;
  }

  async tryUsbPort(portName, skipTest = false) {
    try {
      console.log(`🔌 Testando porta: ${portName}`);
      
      // Configurações mais robustas para diferentes tipos de impressora
      const configs = [
        {
          type: PrinterTypes.EPSON,
          interface: portName,
          width: 48,
          characterSet: 'PC850_MULTILINGUAL',
          removeSpecialCharacters: false,
          options: {
            timeout: 5000
          }
        },
        {
          type: PrinterTypes.STAR,
          interface: portName,
          width: 48,
          characterSet: 'PC850_MULTILINGUAL',
          removeSpecialCharacters: false,
          options: {
            timeout: 5000
          }
        }
      ];

      for (const config of configs) {
        try {
          const printer = new ThermalPrinter(config);
          
          // Timeout para evitar travamento
          const connectionPromise = printer.isPrinterConnected();
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout na conexão')), 10000)
          );
          
          const connected = await Promise.race([connectionPromise, timeoutPromise]);
          
          if (connected) {
            this.printer = printer;
            this.isConnected = true;
            this.lastWorkingPort = portName;
            this.reconnectAttempts = 0;
            
            console.log(`✅ Impressora conectada em ${portName} (${config.type})`);
            
            if (!skipTest) {
              await this.printConnectionTest();
            }
            return true;
          }
        } catch (configErr) {
          console.log(`   ⚠️ Falha com ${config.type}: ${configErr.message}`);
        }
      }
      
      return false;
      
    } catch (err) {
      console.log(`   ❌ Erro na porta ${portName}: ${err.message}`);
      return false;
    }
  }

  async scanAllUsbPorts() {
    try {
      const ports = await SerialPort.list();
      
      if (ports.length === 0) {
        console.error('❌ Nenhuma porta serial detectada!');
        console.error('💡 Dicas:');
        console.error('   - Verifique se a impressora está conectada via USB');
        console.error('   - Instale os drivers da impressora');
        console.error('   - Teste em outro cabo/porta USB');
        return;
      }

      // Filtrar portas que parecem ser impressoras
      const printerPorts = ports.filter(port => {
        const path = port.path.toLowerCase();
        const manufacturer = (port.manufacturer || '').toLowerCase();
        const vendorId = port.vendorId;
        
        // IDs comuns de fabricantes de impressoras térmicas
        const printerVendorIds = ['04b8', '0519', '04da', '067b', '0fe6'];
        const printerManufacturers = ['epson', 'star', 'citizen', 'bixolon'];
        
        return printerVendorIds.includes(vendorId) || 
               printerManufacturers.some(mfg => manufacturer.includes(mfg));
      });

      console.log(`🔍 Encontradas ${ports.length} portas seriais:`);
      ports.forEach(port => {
        const isPrinter = printerPorts.includes(port);
        console.log(`   ${isPrinter ? '🖨️' : '📱'} ${port.path} - ${port.manufacturer || 'Desconhecido'}`);
      });

      // Tentar primeiro as portas que parecem ser impressoras
      for (const port of printerPorts) {
        console.log(`\n🎯 Testando porta prioritária: ${port.path}`);
        if (await this.tryUsbPort(port.path)) {
          return;
        }
      }

      // Se não encontrou nas prioritárias, testar todas
      const remainingPorts = ports.filter(port => !printerPorts.includes(port));
      for (const port of remainingPorts) {
        console.log(`\n🔍 Testando porta: ${port.path}`);
        if (await this.tryUsbPort(port.path)) {
          return;
        }
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
    console.log(`🌐 Testando impressora de rede: ${interfaceString}`);

    try {
      const printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: interfaceString,
        width: 48,
        characterSet: 'PC850_MULTILINGUAL',
        removeSpecialCharacters: false,
        options: {
          timeout: 10000
        }
      });

      const connected = await printer.isPrinterConnected();
      if (connected) {
        this.printer = printer;
        this.isConnected = true;
        console.log(`✅ Impressora de rede conectada: ${interfaceString}`);
        await this.printConnectionTest();
      } else {
        throw new Error(`Sem resposta da impressora em ${interfaceString}`);
      }
    } catch (err) {
      console.error(`❌ Falha na impressora de rede: ${err.message}`);
    }
  }

  async tryTmusbPrinter() {
    console.log('🔌 Testando impressora TMUSB001...');
    try {
      const printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: 'TMUSB001',
        width: 48,
        characterSet: 'PC850_MULTILINGUAL',
        removeSpecialCharacters: false,
      });

      const connected = await printer.isPrinterConnected();
      if (connected) {
        this.printer = printer;
        this.isConnected = true;
        console.log('✅ Impressora TMUSB001 conectada');
        await this.printConnectionTest();
      } else {
        throw new Error('TMUSB001 não respondeu');
      }
    } catch (err) {
      console.error('❌ Falha TMUSB001:', err.message);
    }
  }

  // Teste de conexão mais detalhado
  async printConnectionTest() {
    if (!this.printer) return false;

    try {
      this.printer.clear();
      this.printer.setTextSize(1, 1);
      this.printer.alignCenter();
      this.printer.println('=== TESTE DE CONEXAO ===');
      this.printer.println('');
      this.printer.println('Impressora conectada!');
      this.printer.println(new Date().toLocaleString('pt-BR'));
      this.printer.println('');
      this.printer.println('Sistema: OK');
      this.printer.cut();

      await this.printer.execute();
      console.log('🖨️ Teste de conexão impresso com sucesso');
      return true;
    } catch (err) {
      console.error('❌ Falha no teste de conexão:', err.message);
      this.isConnected = false;
      return false;
    }
  }

  // Método melhorado para impressão de tokens
  async printTokenNumber(token, extraData = {}) {
    if (!this.printer || !this.isConnected) {
      console.error('❌ Impressora desconectada. Tentando reconectar...');
      
      // Tentar reconectar se temos uma porta que funcionava antes
      if (this.lastWorkingPort && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`🔄 Tentativa de reconexão ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        
        if (await this.tryUsbPort(this.lastWorkingPort, true)) {
          return await this.printTokenNumber(token, extraData);
        }
      }
      
      return false;
    }

    try {
      console.log(`🖨️ Imprimindo token: ${token}`);
      
      this.printer.clear();
      
      // Cabeçalho
      this.printer.setTextSize(1, 1);
      this.printer.alignCenter();
      this.printer.println('================================');
      
      // Nome do estabelecimento (se fornecido)
      if (extraData.estabelecimento) {
        this.printer.setTextSize(1, 2);
        this.printer.println(extraData.estabelecimento);
        this.printer.println('');
      }
      
      // Número do token - grande e destacado
      this.printer.setTextSize(3, 3);
      this.printer.alignCenter();
      this.printer.println(`SENHA: ${token}`);
      this.printer.println('');
      
      // Informações adicionais
      this.printer.setTextSize(1, 1);
      this.printer.alignCenter();
      
      if (extraData.categoria) {
        this.printer.println(`Categoria: ${extraData.categoria}`);
      }
      
      // Data e hora
      this.printer.println(new Date().toLocaleString('pt-BR'));
      this.printer.println('');
      
      // Mensagem
      this.printer.println('Aguarde ser chamado');
      this.printer.println('================================');
      
      // Cortar papel
      this.printer.cut();
      
      // Executar impressão
      await this.printer.execute();
      
      console.log(`✅ Token ${token} impresso com sucesso`);
      return true;
      
    } catch (err) {
      console.error(`❌ Erro ao imprimir token ${token}:`, err.message);
      this.isConnected = false;
      return false;
    }
  }

  // Método para verificar status da impressora
  async checkStatus() {
    if (!this.printer) {
      return { connected: false, message: 'Impressora não inicializada' };
    }

    try {
      const connected = await this.printer.isPrinterConnected();
      return {
        connected,
        message: connected ? 'Impressora conectada e funcionando' : 'Impressora desconectada',
        port: this.lastWorkingPort
      };
    } catch (err) {
      return {
        connected: false,
        message: `Erro ao verificar status: ${err.message}`
      };
    }
  }

  // Método para reconexão manual
  async reconnect() {
    console.log('🔄 Iniciando reconexão manual...');
    this.printer = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    
    return await this.init();
  }
}

module.exports = SimplePrinter;
