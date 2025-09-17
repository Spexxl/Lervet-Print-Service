require('dotenv').config();
const io = require('socket.io-client');
const SimplePrinter = require('./printer');

console.log('🚀 Iniciando serviço de impressão...');

// Configurações
const BACKEND_URL = process.env.BACKEND_URL || 'https://lervet-lervet-token-backend.lwzypg.easypanel.host';
const RECONNECT_DELAY = parseInt(process.env.RECONNECT_DELAY) || 5000;
const MAX_RECONNECT_ATTEMPTS = parseInt(process.env.MAX_RECONNECT_ATTEMPTS) || 999;

// Status do sistema
let systemStatus = {
  printerConnected: false,
  socketConnected: false,
  lastToken: null,
  startTime: new Date(),
  totalTokensPrinted: 0,
  printErrors: 0
};

// Inicializar impressora
const printer = new SimplePrinter();

// Função para inicializar impressora com retry
async function initializePrinter() {
  console.log('🖨️ Inicializando impressora...');
  
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`🔄 Tentativa ${attempt}/${maxAttempts}`);
    
    const connected = await printer.init();
    if (connected) {
      systemStatus.printerConnected = true;
      console.log('✅ Impressora inicializada com sucesso!');
      return true;
    }
    
    if (attempt < maxAttempts) {
      console.log(`⏳ Aguardando 5 segundos antes da próxima tentativa...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  console.error('❌ Falha ao inicializar impressora após todas as tentativas');
  systemStatus.printerConnected = false;
  return false;
}

// Conectar ao backend
const socket = io(BACKEND_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
  reconnectionDelay: RECONNECT_DELAY,
  timeout: 10000
});

// Eventos do Socket
socket.on('connect', () => {
  console.log('🔌 Conectado ao backend');
  console.log('📡 Aguardando novos tokens...');
  systemStatus.socketConnected = true;
  
  // Enviar status da impressora para o backend
  socket.emit('printerStatus', {
    connected: systemStatus.printerConnected,
    timestamp: new Date()
  });
});

socket.on('disconnect', (reason) => {
  console.log(`🔌 Desconectado do backend: ${reason}`);
  console.log('🔄 Tentando reconectar...');
  systemStatus.socketConnected = false;
});

socket.on('connect_error', (error) => {
  console.error('❌ Erro de conexão com backend:', error.message);
  systemStatus.socketConnected = false;
});

socket.on('reconnect', (attemptNumber) => {
  console.log(`🔌 Reconectado ao backend (tentativa ${attemptNumber})`);
  systemStatus.socketConnected = true;
});

// EVENTO PRINCIPAL - Novo token criado
socket.on('newToken', async (tokenData) => {
  console.log(`\n🆕 Novo token recebido:`, tokenData);
  
  // Verificar se a impressora ainda está conectada
  if (!systemStatus.printerConnected) {
    console.log('⚠️ Impressora desconectada. Tentando reconectar...');
    systemStatus.printerConnected = await printer.reconnect();
    
    if (!systemStatus.printerConnected) {
      console.error('❌ Falha ao reconectar impressora. Token não será impresso.');
      systemStatus.printErrors++;
      
      // Notificar o backend sobre o erro
      socket.emit('printError', {
        token: tokenData.numero,
        error: 'Impressora desconectada',
        timestamp: new Date()
      });
      return;
    }
  }
  
  // Preparar dados extras para impressão
  const extraData = {
    estabelecimento: tokenData.estabelecimento || process.env.NOME_ESTABELECIMENTO,
    categoria: tokenData.categoria,
    timestamp: new Date()
  };
  
  // Imprimir o token
  const sucesso = await printer.printTokenNumber(tokenData.numero, extraData);
  
  if (sucesso) {
    console.log(`✅ Token ${tokenData.numero} impresso com sucesso`);
    systemStatus.totalTokensPrinted++;
    systemStatus.lastToken = tokenData;
    
    // Notificar o backend que o token foi impresso
    socket.emit('tokenPrinted', {
      token: tokenData.numero,
      timestamp: new Date()
    });
  } else {
    console.error(`❌ Falha ao imprimir token ${tokenData.numero}`);
    systemStatus.printErrors++;
    systemStatus.printerConnected = false;
    
    // Notificar o backend sobre o erro
    socket.emit('printError', {
      token: tokenData.numero,
      error: 'Falha na impressão',
      timestamp: new Date()
    });
  }
});

// Eventos de controle remoto (opcional)
socket.on('printerStatus', async () => {
  const status = await printer.checkStatus();
  socket.emit('printerStatusResponse', {
    ...status,
    systemStatus: systemStatus
  });
});

socket.on('testPrint', async () => {
  console.log('🧪 Teste de impressão solicitado pelo backend');
  const sucesso = await printer.printTokenNumber('TEST', {
    estabelecimento: 'TESTE DO SISTEMA',
    categoria: 'Teste'
  });
  
  socket.emit('testPrintResponse', {
    success: sucesso,
    timestamp: new Date()
  });
});

socket.on('reconnectPrinter', async () => {
  console.log('🔄 Reconexão da impressora solicitada pelo backend');
  systemStatus.printerConnected = await printer.reconnect();
  
  socket.emit('printerReconnectResponse', {
    connected: systemStatus.printerConnected,
    timestamp: new Date()
  });
});

// Função para exibir status do sistema periodicamente
function showSystemStatus() {
  const uptime = Math.floor((new Date() - systemStatus.startTime) / 1000);
  const uptimeFormatted = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`;
  
  console.log('\n📊 === STATUS DO SISTEMA ===');
  console.log(`🖨️ Impressora: ${systemStatus.printerConnected ? '✅ Conectada' : '❌ Desconectada'}`);
  console.log(`🌐 Backend: ${systemStatus.socketConnected ? '✅ Conectado' : '❌ Desconectado'}`);
  console.log(`📈 Tokens impressos: ${systemStatus.totalTokensPrinted}`);
  console.log(`❌ Erros de impressão: ${systemStatus.printErrors}`);
  console.log(`⏰ Tempo ativo: ${uptimeFormatted}`);
  if (systemStatus.lastToken) {
    console.log(`🔢 Último token: ${systemStatus.lastToken.numero}`);
  }
  console.log('==============================\n');
}

// Função de inicialização principal
async function main() {
  try {
    // Inicializar impressora
    await initializePrinter();
    
    // Mostrar status inicial
    showSystemStatus();
    
    // Status periódico (a cada 5 minutos)
    setInterval(showSystemStatus, 5 * 60 * 1000);
    
    console.log('✅ Serviço inicializado com sucesso!');
    console.log('⏳ Pressione Ctrl+C para parar o serviço.');
    
  } catch (error) {
    console.error('❌ Erro crítico na inicialização:', error);
    process.exit(1);
  }
}

// Tratamento de encerramento do processo
process.on('SIGINT', () => {
  console.log('\n🛑 Encerrando serviço...');
  console.log('📊 Estatísticas finais:');
  showSystemStatus();
  
  socket.disconnect();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Serviço terminado pelo sistema');
  socket.disconnect();
  process.exit(0);
});

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
  console.error('❌ Erro não capturado:', error);
  socket.disconnect();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promise rejeitada:', reason);
  console.error('Promise:', promise);
});

// Iniciar o sistema
main();
