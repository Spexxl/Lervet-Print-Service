require('dotenv').config();
const io = require('socket.io-client');
const SimplePrinter = require('./printer');

console.log('🚀 Iniciando serviço de impressão...');

// URL do seu backend
const BACKEND_URL = process.env.BACKEND_URL || 'https://lervet-lervet-token-backend.lwzypg.easypanel.host';

// Inicializar impressora
const printer = new SimplePrinter();

// Conectar ao backend
const socket = io(BACKEND_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 999,
  reconnectionDelay: 5000,
});

// Eventos do Socket
socket.on('connect', () => {
  console.log('🔌 Conectado ao backend');
  console.log('📡 Aguardando novos tokens...');
});

socket.on('disconnect', (reason) => {
  console.log(`🔌 Desconectado: ${reason}`);
  console.log('🔄 Tentando reconectar...');
});

socket.on('connect_error', (error) => {
  console.error('❌ Erro de conexão:', error.message);
});

// EVENTO PRINCIPAL - Novo token criado
socket.on('newToken', async (tokenData) => {
  console.log(`🆕 Novo token recebido: ${tokenData.numero}`);
  
  // Imprimir o número do token
  const sucesso = await printer.printTokenNumber(tokenData.numero);
  
  if (sucesso) {
    console.log(`✅ Token ${tokenData.numero} impresso com sucesso`);
  } else {
    console.log(`❌ Falha ao imprimir token ${tokenData.numero}`);
  }
});

// Manter o processo rodando
process.on('SIGINT', () => {
  console.log('🛑 Encerrando serviço...');
  socket.disconnect();
  process.exit(0);
});

console.log('⏳ Serviço iniciado. Pressione Ctrl+C para parar.');
// Para testar sem backend, adicione no final do main.js:
setTimeout(() => {
  printer.printTokenNumber('999');
}, 5000);