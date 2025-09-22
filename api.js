// api/shopee-tracker-optimized.js
const axios = require('axios');
const cheerio = require('cheerio');

// Cache para evitar requisições repetidas
const cache = new Map();
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutos

module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathParts = url.pathname.split('/');
  const code = pathParts[pathParts.length - 1];

  if (!code || code === 'shopee-tracker-optimized') {
    return res.status(400).json({ 
      error: 'Código de rastreamento é obrigatório',
      example: '/api/shopee-tracker-optimized/BR257514355146J'
    });
  }

  try {
    console.log(`⚡ Buscando rastreamento otimizado: ${code}`);
    
    // Verificar cache
    const cached = cache.get(code);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      console.log(`📦 Retornando do cache: ${code}`);
      return res.status(200).json(cached.data);
    }

    // Fazer requisição HTTP direta (mais rápido que Playwright)
    const response = await axios.get(`https://spx.com.br/track/${code}`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    });

    const $ = cheerio.load(response.data);
    
    // Extrair dados com Cheerio (mais leve que Playwright)
    const status = $('.order-status').text().trim();
    const events = [];
    
    $('.nss-comp-tracking-item').each((index, element) => {
      const timeElement = $(element).find('.time');
      const messageElement = $(element).find('.message');
      
      events.push({
        date: timeElement.find('.day').text().trim(),
        time: timeElement.find('.second').text().trim(),
        description: messageElement.text().trim(),
        timestamp: new Date().getTime() - (index * 60000) // Timestamp aproximado
      });
    });

    const result = {
      success: true,
      tracking: {
        code: code,
        status: status || 'Status não disponível',
        events: events.reverse(), // Ordenar do mais recente para o mais antigo
        lastUpdate: new Date().toISOString()
      }
    };

    // Salvar no cache
    cache.set(code, {
      data: result,
      timestamp: Date.now()
    });

    console.log(`✅ Rastreamento otimizado concluído: ${code}`);
    res.status(200).json(result);

  } catch (error) {
    console.error(`❌ Erro no rastreamento otimizado: ${error.message}`);
    
    // Tentar fallback para a API original se disponível
    try {
      const fallbackResponse = await axios.get(`https://recebasddsa.vercel.app/api/shopee-tracker/${code}`, {
        timeout: 15000
      });
      
      res.status(200).json(fallbackResponse.data);
    } catch (fallbackError) {
      res.status(500).json({ 
        success: false,
        error: 'Falha ao rastrear encomenda',
        message: error.message
      });
    }
  }
};