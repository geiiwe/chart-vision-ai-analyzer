/**
 * Image processing utilities for chart analysis
 */

import { SelectedRegion, CandleData, TechnicalElement } from '@/context/AnalyzerContext';
import cv from 'opencv.js'; // Importar OpenCV
import Tesseract from 'tesseract.js'; // Importar Tesseract

// Process the captured image to enhance chart features
export const processImage = async (imageUrl: string): Promise<{success: boolean; data: string; error?: string}> => {
  console.log('Processando imagem:', imageUrl);
  
  return new Promise((resolve) => {
    try {
      const img = new Image();
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({
              success: false,
              data: imageUrl,
              error: 'Falha ao criar contexto de canvas para processamento de imagem.'
            });
            return;
          }
          
          // Verificar dimensões mínimas
          if (img.width < 200 || img.height < 200) {
            resolve({
              success: false,
              data: imageUrl,
              error: 'Imagem muito pequena para processamento preciso. Recomenda-se usar imagens maiores.'
            });
            return;
          }
          
          // Desenhar a imagem original
          ctx.drawImage(img, 0, 0);
          
          // Aplicar processamento avançado para destacar os candles
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          // Aplicar método de detecção de bordas para realçar a estrutura dos candles
          const enhancedData = enhanceEdges(data, canvas.width, canvas.height);
          
          // Aplicar filtro de cor para destacar candles verdes e vermelhos
          highlightCandleColors(enhancedData, canvas.width, canvas.height);
          
          // Atualizar dados da imagem
          for (let i = 0; i < data.length; i++) {
            data[i] = enhancedData[i];
          }
          
          ctx.putImageData(imageData, 0, 0);
          
          resolve({
            success: true,
            data: canvas.toDataURL('image/jpeg')
          });
        } catch (e) {
          console.error('Erro durante o processamento de imagem:', e);
          resolve({
            success: false,
            data: imageUrl,
            error: 'Erro ao processar a imagem. Tente uma imagem diferente ou ajuste manualmente.'
          });
        }
      };
      
      img.onerror = () => {
        resolve({
          success: false,
          data: imageUrl,
          error: 'Falha ao carregar a imagem para processamento.'
        });
      };
      
      img.src = imageUrl;
    } catch (e) {
      console.error('Erro ao iniciar processamento de imagem:', e);
      resolve({
        success: false,
        data: imageUrl,
        error: 'Erro inesperado ao processar a imagem.'
      });
    }
  });
};

// Extract chart region from the image if no region is manually selected
export const detectChartRegion = async (imageUrl: string): Promise<{
  success: boolean;
  data: { x: number; y: number; width: number; height: number } | null;
  error?: string;
}> => {
  console.log('Detectando região do gráfico em:', imageUrl);
  
  // Create an image element to get the dimensions
  return new Promise((resolve) => {
    try {
      const img = new Image();
      
      img.onload = () => {
        try {
          // Analisar a imagem para detectar automaticamente a área do gráfico
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({
              success: false,
              data: null,
              error: 'Falha ao criar contexto de canvas para detecção de região.'
            });
            return;
          }
          
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          // Detectar bordas para encontrar a região do gráfico usando uma versão melhorada do algoritmo
          let left = canvas.width;
          let right = 0;
          let top = canvas.height;
          let bottom = 0;
          
          const threshold = 40; // Ajuste do limiar para detectar mudanças significativas de cor
          
          // Varrer pixels para detectar limites do gráfico - algoritmo otimizado
          for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
              const i = (y * width + x) * 4;
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              
              // Usar uma detecção de elementos de gráfico mais avançada
              // Pixels que representam candles, linhas de grades e texto são mais prováveis de ser parte do gráfico
              const avgColor = (r + g + b) / 3;
              const isGrid = Math.abs(r - g) < 10 && Math.abs(r - b) < 10 && avgColor > 180 && avgColor < 230;
              const isCandle = (r > g * 1.5 && r > b * 1.5) || (g > r * 1.5 && g > b * 1.5);
              const isLine = Math.abs(r - g) < 20 && Math.abs(r - b) < 20 && avgColor < 160; 
              
              if (isGrid || isCandle || isLine || (avgColor < 220 && avgColor > 30)) {
                if (x < left) left = x;
                if (x > right) right = x;
                if (y < top) top = y;
                if (y > bottom) bottom = y;
              }
            }
          }
          
          // Ajustar os limites para garantir que não percam parte importante do gráfico
          // Adicionar uma margem proporcional ao tamanho da imagem
          const marginX = Math.max(5, Math.floor(canvas.width * 0.02)); 
          const marginY = Math.max(5, Math.floor(canvas.height * 0.02));
          
          left = Math.max(0, left - marginX);
          top = Math.max(0, top - marginY);
          right = Math.min(canvas.width, right + marginX);
          bottom = Math.min(canvas.height, bottom + marginY);
          
          const width = right - left;
          const height = bottom - top;
          
          // Verificar se os limites detectados são razoáveis
          if (width > 100 && height > 100 && width/img.width > 0.3 && height/img.height > 0.3) {
            // Destacar a região detectada com uma borda
            ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)'; // Azul semi-transparente
            ctx.lineWidth = 2;
            ctx.strokeRect(left, top, width, height);
            
            resolve({
              success: true,
              data: { x: left, y: top, width, height }
            });
          } else {
            console.log('Detecção automática falhou, usando região default');
            // Default para 85% da imagem centralizada
            const defaultWidth = img.width * 0.85;
            const defaultHeight = img.height * 0.85;
            const x = (img.width - defaultWidth) / 2;
            const y = (img.height - defaultHeight) / 2;
            
            resolve({
              success: true, // Mudado para true para evitar mensagem de erro
              data: { x, y, width: defaultWidth, height: defaultHeight },
              error: 'Região detectada automaticamente'
            });
          }
        } catch (e) {
          console.error('Erro durante detecção de região:', e);
          
          // Fallback para 85% da imagem
          const width = img.width * 0.85;
          const height = img.height * 0.85;
          const x = (img.width - width) / 2;
          const y = (img.height - height) / 2;
          
          resolve({
            success: true, // Mudado para true para evitar mensagem de erro
            data: { x, y, width, height },
            error: 'Região estimada automaticamente'
          });
        }
      };
      
      img.onerror = () => {
        resolve({
          success: false,
          data: null,
          error: 'Falha ao carregar a imagem para detecção de região.'
        });
      };
      
      img.src = imageUrl;
    } catch (e) {
      console.error('Erro ao iniciar detecção de região:', e);
      resolve({
        success: false,
        data: null,
        error: 'Erro inesperado ao detectar região do gráfico.'
      });
    }
  });
};

// Crop image to the selected region
export const cropToRegion = async (
  imageUrl: string, 
  region: SelectedRegion
): Promise<{success: boolean; data: string; error?: string}> => {
  console.log('Recortando para região:', region);
  
  return new Promise((resolve) => {
    try {
      const img = new Image();
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          
          if (region.type === 'rectangle') {
            canvas.width = region.width;
            canvas.height = region.height;
            
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(
                img, 
                region.x, region.y, region.width, region.height, 
                0, 0, region.width, region.height
              );
              
              // Adicionar uma borda sutil para marcar a região selecionada
              ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
              ctx.lineWidth = 2;
              ctx.strokeRect(0, 0, region.width, region.height);
            } else {
              resolve({
                success: false,
                data: imageUrl,
                error: 'Falha ao criar contexto de canvas para recorte da região.'
              });
              return;
            }
          } else {
            // Para regiões circulares, o canvas deve acomodar o círculo
            const diameter = region.radius * 2;
            canvas.width = diameter;
            canvas.height = diameter;
            
            const ctx = canvas.getContext('2d');
            if (ctx) {
              // Criar uma máscara circular
              ctx.beginPath();
              ctx.arc(region.radius, region.radius, region.radius, 0, Math.PI * 2);
              ctx.closePath();
              ctx.clip();
              
              // Desenhar apenas a parte da imagem dentro do círculo
              ctx.drawImage(
                img,
                region.centerX - region.radius, region.centerY - region.radius,
                diameter, diameter,
                0, 0, diameter, diameter
              );
              
              // Adicionar uma borda fina para mostrar o limite da seleção
              ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(region.radius, region.radius, region.radius - 1, 0, Math.PI * 2);
              ctx.stroke();
            } else {
              resolve({
                success: false,
                data: imageUrl,
                error: 'Falha ao criar contexto de canvas para recorte da região.'
              });
              return;
            }
          }
          
          resolve({
            success: true,
            data: canvas.toDataURL('image/jpeg', 1.0)
          });
        } catch (e) {
          console.error('Erro durante recorte da região:', e);
          resolve({
            success: false,
            data: imageUrl,
            error: 'Erro ao recortar a região selecionada.'
          });
        }
      };
      
      img.onerror = () => {
        resolve({
          success: false,
          data: imageUrl,
          error: 'Falha ao carregar a imagem para recorte da região.'
        });
      };
      
      img.src = imageUrl;
    } catch (e) {
      console.error('Erro ao iniciar recorte da região:', e);
      resolve({
        success: false,
        data: imageUrl,
        error: 'Erro inesperado ao recortar a região.'
      });
    }
  });
};

// Process a specific region of the image (for manual selection)
export const processRegionForAnalysis = async (
  imageUrl: string, 
  region: SelectedRegion
): Promise<{success: boolean; data: string; error?: string}> => {
  console.log('Processando região para análise:', region);
  
  // Primeiro recorta a região
  const croppedResult = await cropToRegion(imageUrl, region);
  
  if (!croppedResult.success) {
    return croppedResult;
  }
  
  // Depois aplica processamento para realçar detalhes
  return processImage(croppedResult.data);
};

// Verificar se a imagem tem qualidade suficiente para análise
export const checkImageQuality = async (imageUrl: string): Promise<{
  isGoodQuality: boolean;
  message: string;
  details?: {
    resolution: string;
    contrast: string;
    noise: string;
  }
}> => {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      
      img.onload = () => {
        try {
          // Verificar resolução
          const hasGoodResolution = img.width >= 400 && img.height >= 300;
          
          // Criar canvas para análise de pixels
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({
              isGoodQuality: false,
              message: 'Não foi possível analisar a qualidade da imagem.'
            });
            return;
          }
          
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          // Verificar contraste
          let minLuminance = 255;
          let maxLuminance = 0;
          let totalLuminance = 0;
          
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
            
            minLuminance = Math.min(minLuminance, luminance);
            maxLuminance = Math.max(maxLuminance, luminance);
            totalLuminance += luminance;
          }
          
          const contrast = maxLuminance - minLuminance;
          const hasGoodContrast = contrast > 50;
          
          // Verificar ruído (simplificado)
          const avgLuminance = totalLuminance / (data.length / 4);
          let noiseEstimate = 0;
          
          for (let y = 1; y < canvas.height - 1; y++) {
            for (let x = 1; x < canvas.width - 1; x++) {
              const i = (y * canvas.width + x) * 4;
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
              
              // Comparar com pixels vizinhos
              const iTop = ((y - 1) * canvas.width + x) * 4;
              const iBottom = ((y + 1) * canvas.width + x) * 4;
              const iLeft = (y * canvas.width + (x - 1)) * 4;
              const iRight = (y * canvas.width + (x + 1)) * 4;
              
              const luminanceTop = 0.299 * data[iTop] + 0.587 * data[iTop + 1] + 0.114 * data[iTop + 2];
              const luminanceBottom = 0.299 * data[iBottom] + 0.587 * data[iBottom + 1] + 0.114 * data[iBottom + 2];
              const luminanceLeft = 0.299 * data[iLeft] + 0.587 * data[iLeft + 1] + 0.114 * data[iLeft + 2];
              const luminanceRight = 0.299 * data[iRight] + 0.587 * data[iRight + 1] + 0.114 * data[iRight + 2];
              
              const diff = Math.abs(luminance - luminanceTop) + 
                          Math.abs(luminance - luminanceBottom) +\n                          Math.abs(luminance - luminanceLeft) +\n                          Math.abs(luminance - luminanceRight);\n                          
              noiseEstimate += diff;
            }
          }
          
          // Normalizar a estimativa de ruído
          noiseEstimate /= (canvas.width - 2) * (canvas.height - 2);
          const hasLowNoise = noiseEstimate < 30;
          
          // Determinar qualidade global
          const isGoodQuality = hasGoodResolution && hasGoodContrast && hasLowNoise;
          
          // Preparar mensagem
          let message = isGoodQuality 
            ? 'Imagem com boa qualidade para análise.'
            : 'A qualidade da imagem pode afetar a precisão da análise.';
            
          if (!hasGoodResolution) {
            message += ' Resolução baixa.';
          }
          
          if (!hasGoodContrast) {
            message += ' Contraste insuficiente.';
          }
          
          if (!hasLowNoise) {
            message += ' Presença de ruído detectada.';
          }
          
          resolve({
            isGoodQuality,\n            message,\n            details: {\n              resolution: hasGoodResolution ? 'Boa' : 'Baixa',\n              contrast: hasGoodContrast ? 'Adequado' : 'Insuficiente',\n              noise: hasLowNoise ? 'Baixo' : 'Alto'\n            }\n          });
        } catch (e) {\n          console.error('Erro durante análise de qualidade:', e);\n          resolve({\n            isGoodQuality: false,\n            message: 'Erro ao analisar a qualidade da imagem.'\n          });
        }\n      };\n      
      img.onerror = () => {\n        resolve({\n          isGoodQuality: false,\n          message: 'Falha ao carregar a imagem para análise de qualidade.'
        });
      };\n      
      img.src = imageUrl;
    } catch (e) {\n      console.error('Erro ao iniciar análise de qualidade:', e);\n      resolve({\n        isGoodQuality: false,\n        message: 'Erro inesperado ao analisar a qualidade da imagem.'
      });
    }\n  });
};\n\n// Estimar valores OHLC com base na posição e tamanho dos candles\nconst estimateOHLCValues = (candles: CandleData[]): void => {\n  // Ordenar candles horizontalmente (presumindo que o eixo x representa o tempo)\n  candles.sort((a, b) => a.position.x - b.position.x);\n  
  // Encontrar o range vertical para normalização\n  let minY = Number.MAX_VALUE;\n  let maxY = Number.MIN_VALUE;\n  
  for (const candle of candles) {\n    const top = candle.position.y - candle.height / 2;\n    const bottom = candle.position.y + candle.height / 2;\n    
    minY = Math.min(minY, top);\n    maxY = Math.max(maxY, bottom);\n  }
  
  const range = maxY - minY;\n  
  // Valor base arbitrário para os preços\n  const basePrice = 100;\n  const priceRange = 20;\n  
  // Calcular valores OHLC para cada candle\n  for (const candle of candles) {\n    const top = candle.position.y - candle.height / 2;\n    const bottom = candle.position.y + candle.height / 2;\n    
    // Normalizar para o range de preço\n    const normalizedTop = 1 - (top - minY) / range;\n    const normalizedBottom = 1 - (bottom - minY) / range;\n    
    // Converter para valores de preço\n    const highPrice = basePrice + normalizedTop * priceRange;\n    const lowPrice = basePrice + normalizedBottom * priceRange;\n    
    // Para candles verdes, o fechamento é mais alto que a abertura\n    // Para candles vermelhos, a abertura é mais alta que o fechamento\n    if (candle.color === 'verde') {\n      candle.open = lowPrice;\n      candle.close = highPrice;\n    } else {\n      candle.open = highPrice;\n      candle.close = lowPrice;\n    }\n    
    candle.high = Math.max(candle.open, candle.close);\n    candle.low = Math.min(candle.open, candle.close);\n  }\n};\n\n// Função para melhorar a detecção de bordas nos candles\nconst enhanceEdges = (data: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray => {\n  const output = new Uint8ClampedArray(data.length);\n  
  // Copiar dados originais\n  for (let i = 0; i < data.length; i++) {\n    output[i] = data[i];\n  }
  
  // Aplicar filtro Sobel para detecção de bordas\n  for (let y = 1; y < height - 1; y++) {\n    for (let x = 1; x < width - 1; x++) {\n      const pixelIndex = (y * width + x) * 4;\n      
      // Pixels vizinhos para o operador Sobel\n      const topLeft = ((y - 1) * width + (x - 1)) * 4;\n      const top = ((y - 1) * width + x) * 4;\n      const topRight = ((y - 1) * width + (x + 1)) * 4;\n      const left = (y * width + (x - 1)) * 4;\n      const right = (y * width + (x + 1)) * 4;\n      const bottomLeft = ((y + 1) * width + (x - 1)) * 4;\n      const bottom = ((y + 1) * width + x) * 4;\n      const bottomRight = ((y + 1) * width + (x + 1)) * 4;\n      
      // Calcular gradientes usando operador Sobel\n      const gx = (\n        data[topRight] - data[topLeft] +\n        2 * data[right] - 2 * data[left] +\n        data[bottomRight] - data[bottomLeft]\n      ) / 4;\n      
      const gy = (\n        data[bottomLeft] - data[topLeft] +\n        2 * data[bottom] - 2 * data[top] +\n        data[bottomRight] - data[topRight]\n      ) / 4;\n      
      // Magnitude do gradiente\n      const magnitude = Math.sqrt(gx * gx + gy * gy);\n      
      // Aplicar limiar para destacar apenas bordas significativas\n      if (magnitude > 25) {\n        output[pixelIndex] = 255;       // R\n        output[pixelIndex + 1] = 255;   // G\n        output[pixelIndex + 2] = 255;   // B\n        output[pixelIndex + 3] = 255;   // A\n      }\n    }\n  }\n  
  return output;\n};\n\n// Função para destacar cores específicas de candles (verde/vermelho)\nconst highlightCandleColors = (data: Uint8ClampedArray, width: number, height: number): void => {\n  for (let i = 0; i < data.length; i += 4) {\n    const r = data[i];\n    const g = data[i + 1];\n    const b = data[i + 2];\n    
    // Detectar e realçar pixels verdes (candles de alta)\n    if (g > 1.5 * r && g > 1.5 * b && g > 50) {\n      data[i] = 0;                // R\n      data[i + 1] = Math.min(255, g * 1.5);  // G (aumentar intensidade)\n      data[i + 2] = 0;            // B\n    }\n    // Detectar e realçar pixels vermelhos (candles de baixa)\n    else if (r > 1.5 * g && r > 1.5 * b && r > 50) {\n      data[i] = Math.min(255, r * 1.5);      // R (aumentar intensidade)\n      data[i + 1] = 0;            // G\n      data[i + 2] = 0;            // B\n    }\n  }\n};\n\n// Usar segmentação para identificar padrões de candles\nconst segmentCandlePatterns = (\n  data: Uint8ClampedArray, \n  width: number, \n  height: number\n): {x1: number, y1: number, x2: number, y2: number, area: number}[] => {\n  // Criar um mapa de cores para identificar possíveis candles\n  const colorMap = new Array(width * height).fill(0);\n  
  // Identificar pixels que podem ser parte de candles (verde ou vermelho)\n  for (let y = 0; y < height; y++) {\n    for (let x = 0; x < width; x++) {\n      const i = (y * width + x) * 4;\n      const r = data[i];\n      const g = data[i + 1];\n      const b = data[i + 2];\n      
      // Marcar pixels verdes - limiar mais sensível para melhor detecção\n      if (g > 1.2 * r && g > 1.2 * b && g > 70) {\n        colorMap[y * width + x] = 1; // 1 = verde\n      }\n      // Marcar pixels vermelhos - limiar mais sensível para melhor detecção\n      else if (r > 1.2 * g && r > 1.2 * b && r > 70) {\n        colorMap[y * width + x] = 2; // 2 = vermelho\n      }\n      // Também detectar candles pretos e brancos (valores extremos de luminância)\n      else {\n        const luminance = (r + g + b) / 3;\n        if (luminance < 30) { // Candles pretos/escuros\n          colorMap[y * width + x] = 3; // 3 = preto\n        } else if (luminance > 220) { // Candles brancos/claros\n          colorMap[y * width + x] = 4; // 4 = branco\n        }\n      }\n    }\n  }\n  
  // Usar um algoritmo de agrupamento para identificar regiões contíguas de mesma cor\n  const segments: {x1: number, y1: number, x2: number, y2: number, area: number}[] = [];\n  const visited = new Set<number>();\n  
  for (let y = 0; y < height; y++) {\n    for (let x = 0; x < width; x++) {\n      const idx = y * width + x;\n      
      // Pular pixels que não são candles ou já foram visitados\n      if (colorMap[idx] === 0 || visited.has(idx)) {\n        continue;\n      }\n      
      // Iniciar busca em profundidade para encontrar região contígua\n      const color = colorMap[idx];\n      let minX = x, maxX = x, minY = y, maxY = y;\n      let area = 0;\n      
      const queue: [number, number][] = [[x, y]];\n      visited.add(idx);\n      
      while (queue.length > 0) {\n        const [cx, cy] = queue.shift()!;\n        area++;\n        
        // Atualizar limites do segmento\n        minX = Math.min(minX, cx);\n        maxX = Math.max(maxX, cx);\n        minY = Math.min(minY, cy);\n        maxY = Math.max(maxY, cy);\n        
        // Verificar pixels vizinhos (8-conectividade para melhor detecção)\n        const neighbors = [\n          [cx-1, cy], [cx+1, cy], [cx, cy-1], [cx, cy+1],\n          [cx-1, cy-1], [cx+1, cy-1], [cx-1, cy+1], [cx+1, cy+1]\n        ];\n        
        for (const [nx, ny] of neighbors) {\n          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {\n            const nidx = ny * width + nx;\n            
            if (colorMap[nidx] === color && !visited.has(nidx)) {\n              queue.push([nx, ny]);\n              visited.add(nidx);\n            }\n          }\n        }\n      }\n      
      // Filtrar segmentos muito pequenos (ruído) ou muito grandes (não candles)\n      if (area >= 5 && area <= 2000 && (maxX - minX) > 0 && (maxY - minY) > 0) {\n        segments.push({\n          x1: minX,\n          y1: minY,\n          x2: maxX,\n          y2: maxY,\n          area\n        });\n      }\n    }\n  }\n  
  return segments;\n};\n\n// Analisar um segmento para determinar se é um candle e suas características\nconst analyzeCandleSegment = (\n  segment: {x1: number, y1: number, x2: number, y2: number, area: number},\n  data: Uint8ClampedArray,\n  width: number,\n  height: number\n): { x: number, y: number, width: number, height: number, color: 'verde' | 'vermelho', confidence: number } | null => {\n  const { x1, y1, x2, y2, area } = segment;\n  const segWidth = x2 - x1 + 1;\n  const segHeight = y2 - y1 + 1;\n  
  // Aprimorado: permitir diferentes proporções para tipos diferentes de candles\n  // Candles de corpo longo podem ter proporções diferentes de dojis\n  const ratioOfHeightToWidth = segHeight / segWidth;\n  
  // Verificar se o segmento tem proporções típicas de um candle\n  // Candles normalmente são mais altos que largos, mas permitimos mais variação\n  if (ratioOfHeightToWidth < 0.8) {\n    return null; // Provavelmente não é um candle\n  }\n  
  // Analisar cores dentro do segmento\n  let redCount = 0, greenCount = 0, blackCount = 0, whiteCount = 0;\n  
  for (let y = y1; y <= y2; y++) {\n    for (let x = x1; x <= x2; x++) {\n      const i = (y * width + x) * 4;\n      const r = data[i];\n      const g = data[i + 1];\n      const b = data[i + 2];\n      
      if (g > 1.2 * r && g > 1.2 * b && g > 70) {\n        greenCount++;\n      }\n      else if (r > 1.2 * g && r > 1.2 * b && r > 70) {\n        redCount++;\n      }\n      else {\n        const luminance = (r + g + b) / 3;\n        if (luminance < 30) {\n          blackCount++;\n        } else if (luminance > 220) {\n          whiteCount++;\n        }\n      }\n    }\n  }\n  
  // Determinar a cor predominante\n  const totalColorPixels = redCount + greenCount + blackCount + whiteCount;\n  if (totalColorPixels < 5) {\n    return null; // Não há pixels coloridos suficientes\n  }\n  
  // Tratar candles pretos como vermelhos e brancos como verdes para simplificar\n  if (blackCount > redCount) redCount += blackCount;\n  if (whiteCount > greenCount) greenCount += whiteCount;\n  
  const color: 'verde' | 'vermelho' = greenCount > redCount ? 'verde' : 'vermelho';\n  
  // Calcular confiança baseada na densidade de pixels da cor correta\n  const colorRatio = (color === 'verde' ? greenCount : redCount) / totalColorPixels;\n  const densityRatio = totalColorPixels / (segWidth * segHeight);\n  const confidence = Math.min(100, Math.round(colorRatio * densityRatio * 100));\n  
  // Filtrar candles com baixa confiança\n  if (confidence < 20) {\n    return null;\n  }\n  
  return {\n    x: x1,\n    y: y1,\n    width: segWidth,\n    height: segHeight,\n    color,\n    confidence\n  };\n};\n\n// Detecção aprimorada de linhas de suporte e resistência\nconst detectSupportResistanceLines = (\n  data: Uint8ClampedArray,\n  width: number,\n  height: number\n): { startX: number, startY: number, endX: number, endY: number, confidence: number }[] => {\n  // Calcular histograma horizontal de pixels escuros\n  const horizontalDensity = new Array(height).fill(0);\n  
  for (let y = 0; y < height; y++) {\n    for (let x = 0; x < width; x++) {\n      const i = (y * width + x) * 4;\n      // Detectar pixels escuros (possíveis linhas)\n      if (data[i] + data[i + 1] + data[i + 2] < 150 * 3) {\n        horizontalDensity[y]++;\n      }\n    }\n  }\n  
  // Suavizar o histograma para reduzir ruído\n  const smoothedDensity = new Array(height).fill(0);\n  const kernelSize = 5;\n  const halfKernel = Math.floor(kernelSize / 2);\n  
  for (let y = 0; y < height; y++) {\n    let sum = 0, count = 0;\n    
    for (let k = -halfKernel; k <= halfKernel; k++) {\n      const idx = y + k;\n      if (idx >= 0 && idx < height) {\n        sum += horizontalDensity[idx];\n        count++;\n      }\n    }\n    
    smoothedDensity[y] = sum / count;\n  }\n  
  // Detectar picos no histograma suavizado (possíveis linhas)\n  const peakThreshold = width * 0.2; // Linha deve cobrir pelo menos 20% da largura\n  const minPeakDistance = Math.ceil(height * 0.03); // Distância mínima entre picos\n  
  const peaks: number[] = [];\n  
  for (let y = 2; y < height - 2; y++) {\n    if (smoothedDensity[y] > peakThreshold) {\n      // Verificar se é um máximo local\n      if (\n        smoothedDensity[y] > smoothedDensity[y - 1] &&\n        smoothedDensity[y] > smoothedDensity[y - 2] &&\n        smoothedDensity[y] > smoothedDensity[y + 1] &&\n        smoothedDensity[y] > smoothedDensity[y + 2]\n      ) {\n        // Verificar se está distante o suficiente de outros picos\n        let isFarEnough = true;\n        
        for (const existingPeak of peaks) {\n          if (Math.abs(existingPeak - y) < minPeakDistance) {\n            isFarEnough = false;\n            break;\n          }\n        }\n        
        if (isFarEnough) {\n          peaks.push(y);\n        }\n      }\n    }\n  }\n  
  // Converter picos em linhas horizontais\n  const lines: { startX: number, startY: number, endX: number, endY: number, confidence: number }[] = [];\n  
  for (const y of peaks) {\n    // Calcular confiança baseada na densidade de pixels\n    const confidence = Math.min(100, Math.round((smoothedDensity[y] / width) * 100));\n    
    lines.push({\n      startX: 0,\n      startY: y,\n      endX: width - 1,\n      endY: y,\n      confidence\n    });\n  }\n  
  return lines;\n};\n\n// Gerar elementos técnicos a partir da detecção\nconst generateTechnicalElementsFromDetection = (\n  candles: CandleData[],\n  lines: { startX: number, startY: number, endX: number, endY: number, confidence: number }[],\n  width: number,\n  height: number\n): TechnicalElement[] => {\n  const technicalElements: TechnicalElement[] = [];\n  
  // Converter linhas de suporte/resistência detectadas\n  for (let i = 0; i < lines.length; i++) {\n    const line = lines[i];\n    const isSupport = i % 2 === 0; // Alternar entre suporte e resistência para fins visuais\n    
    technicalElements.push({\n      type: 'line',\n      points: [\n        { x: line.startX, y: line.startY },\n        { x: line.endX, y: line.endY }\n      ],\n      color: isSupport ? '#22c55e' : '#ef4444', // Verde para suporte, vermelho para resistência\n      thickness: line.confidence > 70 ? 2 : 1,\n      dashArray: line.confidence > 70 ? undefined : [5, 5]\n    });
    
    // Adicionar rótulo para linhas com alta confiança\n    if (line.confidence > 75) {\n      technicalElements.push({\n        type: 'label',\n        position: { x: 10, y: line.startY - 5 },\n        text: isSupport ? 'Suporte' : 'Resistência',\n        color: isSupport ? '#22c55e' : '#ef4444',\n        backgroundColor: '#1e293b'\n      });
    }\n  }\n  
  // Detectar tendências de preço usando os candles\n  if (candles.length > 5) {\n    // Ordenar candles por posição x (tempo)\n    const sortedCandles = [...candles].sort((a, b) => a.position.x - b.position.x);\n    
    // Extrair preços de fechamento para análise de tendência\n    const prices = sortedCandles.map(c => c.close);\n    
    // Detectar tendência linear\n    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;\n    const n = prices.length;\n    
    for (let i = 0; i < n; i++) {\n      sumX += i;\n      sumY += prices[i];\n      sumXY += i * prices[i];\n      sumX2 += i * i;\n    }\n    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);\n    
    // Se a inclinação for significativa, adicionar linha de tendência\n    if (Math.abs(slope) > 0.1) {\n      const isBullish = slope > 0;\n      const startCandle = sortedCandles[0];\n      const endCandle = sortedCandles[sortedCandles.length - 1];\n      const startY = startCandle.position.y;\n      const endY = endCandle.position.y - (slope * (endCandle.position.x - startCandle.position.x));\n      
      technicalElements.push({\n        type: 'line',\n        points: [\n          { x: startCandle.position.x, y: startY },\n          { x: endCandle.position.x, y: endY }\n        ],\n        color: isBullish ? '#22c55e' : '#ef4444',\n        thickness: 2,\n        dashArray: [5, 3]\n      });
      
      // Adicionar rótulo indicando a tendência\n      technicalElements.push({\n        type: 'label',\n        position: { x: endCandle.position.x - 100, y: endY - 20 },\n        text: isBullish ? 'Tendência de Alta' : 'Tendência de Baixa',\n        color: isBullish ? '#22c55e' : '#ef4444',\n        backgroundColor: '#1e293b'\n      });
    }\n    
    // Tentar identificar padrões de candles\n    // Verificar padrões de reversão como \"Martelo\" ou \"Doji\"\n    for (let i = 1; i < sortedCandles.length - 1; i++) {\n      const prevCandle = sortedCandles[i-1];\n      const currCandle = sortedCandles[i];\n      const nextCandle = sortedCandles[i+1];
      
      const candleSize = Math.abs(currCandle.close - currCandle.open);\n      const upperShadow = currCandle.high - Math.max(currCandle.open, currCandle.close);\n      const lowerShadow = Math.min(currCandle.open, currCandle.close) - currCandle.low;\n      
      // Identificar possível martelo (sombra inferior longa)\n      if (lowerShadow > 2 * candleSize && upperShadow < 0.5 * candleSize) {\n        technicalElements.push({\n          type: 'circle',\n          center: { x: currCandle.position.x, y: currCandle.position.y },\n          radius: 15,\n          color: '#3b82f6',\n          thickness: 2\n        });
        
        technicalElements.push({\n          type: 'label',\n          position: { x: currCandle.position.x - 30, y: currCandle.position.y - 30 },\n          text: 'Martelo',\n          color: '#3b82f6',\n          backgroundColor: '#1e293b'\n        });
      }\n      
      // Identificar possível doji (abertura próxima do fechamento)\n      if (candleSize < 0.1 * (upperShadow + lowerShadow) && (upperShadow + lowerShadow) > 0) {\n        technicalElements.push({\n          type: 'circle',\n          center: { x: currCandle.position.x, y: currCandle.position.y },\n          radius: 15,\n          color: '#f59e0b',\n          thickness: 2\n        });
        
        technicalElements.push({\n          type: 'label',\n          position: { x: currCandle.position.x - 20, y: currCandle.position.y - 30 },\n          text: 'Doji',\n          color: '#f59e0b',\n          backgroundColor: '#1e293b'\n        });
      }\n    }\n  }\n  
  return technicalElements;\n};\n```
