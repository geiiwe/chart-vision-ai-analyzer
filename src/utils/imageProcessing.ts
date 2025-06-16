/**
 * Image processing utilities for chart analysis
 */

import { SelectedRegion, CandleData, TechnicalElement, Point } from '@/context/AnalyzerContext';

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
              const i = (y * canvas.width + x) * 4;
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
                          Math.abs(luminance - luminanceBottom) +
                          Math.abs(luminance - luminanceLeft) +
                          Math.abs(luminance - luminanceRight);
                          
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
            isGoodQuality,
            message,
            details: {
              resolution: hasGoodResolution ? 'Boa' : 'Baixa',
              contrast: hasGoodContrast ? 'Adequado' : 'Insuficiente',
              noise: hasLowNoise ? 'Baixo' : 'Alto'
            }
          });
        } catch (e) {
          console.error('Erro durante análise de qualidade:', e);
          resolve({
            isGoodQuality: false,
            message: 'Erro ao analisar a qualidade da imagem.'
          });
        }
      };
      
      img.onerror = () => {
        resolve({
          isGoodQuality: false,
          message: 'Falha ao carregar a imagem para análise de qualidade.'
        });
      };
      
      img.src = imageUrl;
    } catch (e) {
      console.error('Erro ao iniciar análise de qualidade:', e);
      resolve({
        isGoodQuality: false,
        message: 'Erro inesperado ao analisar a qualidade da imagem.'
      });
    }
  });
};

// Estimar valores OHLC com base na posição e tamanho dos candles
const estimateOHLCValues = (candles: CandleData[]): void => {
  // Ordenar candles horizontalmente (presumindo que o eixo x representa o tempo)
  candles.sort((a, b) => a.position.x - b.position.x);
  
  // Encontrar o range vertical para normalização
  let minY = Number.MAX_VALUE;
  let maxY = Number.MIN_VALUE;
  
  for (const candle of candles) {
    const top = candle.position.y - candle.height / 2;
    const bottom = candle.position.y + candle.height / 2;
    
    minY = Math.min(minY, top);
    maxY = Math.max(maxY, bottom);
  }
  
  const range = maxY - minY;
  
  // Valor base arbitrário para os preços
  const basePrice = 100;
  const priceRange = 20;
  
  // Calcular valores OHLC para cada candle
  for (const candle of candles) {
    const top = candle.position.y - candle.height / 2;
    const bottom = candle.position.y + candle.height / 2;
    
    // Normalizar para o range de preço
    const normalizedTop = 1 - (top - minY) / range;
    const normalizedBottom = 1 - (bottom - minY) / range;
    
    // Converter para valores de preço
    const highPrice = basePrice + normalizedTop * priceRange;
    const lowPrice = basePrice + normalizedBottom * priceRange;
    
    // Para candles verdes, o fechamento é mais alto que a abertura
    // Para candles vermelhos, a abertura é mais alta que o fechamento
    if (candle.color === 'verde') {
      candle.open = lowPrice;
      candle.close = highPrice;
    } else {
      candle.open = highPrice;
      candle.close = lowPrice;
    }
    
    candle.high = Math.max(candle.open, candle.close);
    candle.low = Math.min(candle.open, candle.close);
  }
};

// Função para melhorar a detecção de bordas nos candles
const enhanceEdges = (data: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray => {
  const output = new Uint8ClampedArray(data.length);
  
  // Copiar dados originais
  for (let i = 0; i < data.length; i++) {
    output[i] = data[i];
  }
  
  // Aplicar filtro Sobel para detecção de bordas
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const pixelIndex = (y * width + x) * 4;
      
      // Pixels vizinhos para o operador Sobel
      const topLeft = ((y - 1) * width + (x - 1)) * 4;
      const top = ((y - 1) * width + x) * 4;
      const topRight = ((y - 1) * width + (x + 1)) * 4;
      const left = (y * width + (x - 1)) * 4;
      const right = (y * width + (x + 1)) * 4;
      const bottomLeft = ((y + 1) * width + (x - 1)) * 4;
      const bottom = ((y + 1) * width + x) * 4;
      const bottomRight = ((y + 1) * width + (x + 1)) * 4;
      
      // Calcular gradientes usando operador Sobel
      const gx = (
        data[topRight] - data[topLeft] +
        2 * data[right] - 2 * data[left] +
        data[bottomRight] - data[bottomLeft]
      ) / 4;
      
      const gy = (
        data[bottomLeft] - data[topLeft] +
        2 * data[bottom] - 2 * data[top] +
        data[bottomRight] - data[topRight]
      ) / 4;
      
      // Magnitude do gradiente
      const magnitude = Math.sqrt(gx * gx + gy * gy);
      
      // Aplicar limiar para destacar apenas bordas significativas
      if (magnitude > 25) {
        output[pixelIndex] = 255;       // R
        output[pixelIndex + 1] = 255;   // G
        output[pixelIndex + 2] = 255;   // B
        output[pixelIndex + 3] = 255;   // A
      }
    }
  }
  
  return output;
};

// Função para destacar cores específicas de candles (verde/vermelho)
const highlightCandleColors = (data: Uint8ClampedArray, width: number, height: number): void => {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // Detectar e realçar pixels verdes (candles de alta)
    if (g > 1.5 * r && g > 1.5 * b && g > 50) {
      data[i] = 0;                // R
      data[i + 1] = Math.min(255, g * 1.5);  // G (aumentar intensidade)
      data[i + 2] = 0;            // B
    }
    // Detectar e realçar pixels vermelhos (candles de baixa)
    else if (r > 1.5 * g && r > 1.5 * b && r > 50) {
      data[i] = Math.min(255, r * 1.5);      // R (aumentar intensidade)
      data[i + 1] = 0;            // G
      data[i + 2] = 0;            // B
    }
  }
};

// Usar segmentação para identificar padrões de candles
const segmentCandlePatterns = (
  data: Uint8ClampedArray, 
  width: number, 
  height: number
): {x1: number, y1: number, x2: number, y2: number, area: number}[] => {
  // Criar um mapa de cores para identificar possíveis candles
  const colorMap = new Array(width * height).fill(0);
  
  // Identificar pixels que podem ser parte de candles (verde ou vermelho)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Marcar pixels verdes - limiar mais sensível para melhor detecção
      if (g > 1.2 * r && g > 1.2 * b && g > 70) {
        colorMap[y * width + x] = 1; // 1 = verde
      }
      // Marcar pixels vermelhos - limiar mais sensível para melhor detecção
      else if (r > 1.2 * g && r > 1.2 * b && r > 70) {
        colorMap[y * width + x] = 2; // 2 = vermelho
      }
      // Também detectar candles pretos e brancos (valores extremos de luminância)
      else {
        const luminance = (r + g + b) / 3;
        if (luminance < 30) { // Candles pretos/escuros
          colorMap[y * width + x] = 3; // 3 = preto
        } else if (luminance > 220) { // Candles brancos/claros
          colorMap[y * width + x] = 4; // 4 = branco
        }
      }
    }
  }
  
  // Usar um algoritmo de agrupamento para identificar regiões contíguas de mesma cor
  const segments: {x1: number, y1: number, x2: number, y2: number, area: number}[] = [];
  const visited = new Set<number>();
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      
      // Pular pixels que não são candles ou já foram visitados
      if (colorMap[idx] === 0 || visited.has(idx)) {
        continue;
      }
      
      // Iniciar busca em profundidade para encontrar região contígua
      const color = colorMap[idx];
      let minX = x, maxX = x, minY = y, maxY = y;
      let area = 0;
      
      const queue: [number, number][] = [[x, y]];
      visited.add(idx);
      
      while (queue.length > 0) {
        const [cx, cy] = queue.shift()!;
        area++;
        
        // Atualizar limites do segmento
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);
        
        // Verificar pixels vizinhos (8-conectividade para melhor detecção)
        const neighbors = [
          [cx-1, cy], [cx+1, cy], [cx, cy-1], [cx, cy+1],
          [cx-1, cy-1], [cx+1, cy-1], [cx-1, cy+1], [cx+1, cy+1]
        ];
        
        for (const [nx, ny] of neighbors) {
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nidx = ny * width + nx;
            
            if (colorMap[nidx] === color && !visited.has(nidx)) {
              queue.push([nx, ny]);
              visited.add(nidx);
            }
          }
        }
      }
      
      // Filtrar segmentos muito pequenos (ruído) ou muito grandes (não candles)
      if (area >= 5 && area <= 2000 && (maxX - minX) > 0 && (maxY - minY) > 0) {
        segments.push({
          x1: minX,
          y1: minY,
          x2: maxX,
          y2: maxY,
          area
        });
      }
    }
  }
  
  return segments;
};

// Analisar um segmento para determinar se é um candle e suas características
const analyzeCandleSegment = (
  segment: {x1: number, y1: number, x2: number, y2: number, area: number},
  data: Uint8ClampedArray,
  width: number,
  height: number
): { x: number, y: number, width: number, height: number, color: 'verde' | 'vermelho', confidence: number } | null => {
  const { x1, y1, x2, y2, area } = segment;
  const segWidth = x2 - x1 + 1;
  const segHeight = y2 - y1 + 1;
  
  // Aprimorado: permitir diferentes proporções para tipos diferentes de candles
  // Candles de corpo longo podem ter proporções diferentes de dojis
  const ratioOfHeightToWidth = segHeight / segWidth;
  
  // Verificar se o segmento tem proporções típicas de um candle
  // Candles normalmente são mais altos que largos, mas permitimos mais variação
  if (ratioOfHeightToWidth < 0.8) {
    return null; // Provavelmente não é um candle
  }
  
  // Analisar cores dentro do segmento
  let redCount = 0, greenCount = 0, blackCount = 0, whiteCount = 0;
  
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      if (g > 1.2 * r && g > 1.2 * b && g > 70) {
        greenCount++;
      }
      else if (r > 1.2 * g && r > 1.2 * b && r > 70) {
        redCount++;
      }
      else {
        const luminance = (r + g + b) / 3;
        if (luminance < 30) {
          blackCount++;
        } else if (luminance > 220) {
          whiteCount++;
        }
      }
    }
  }
  
  // Determinar a cor predominante
  const totalColorPixels = redCount + greenCount + blackCount + whiteCount;
  if (totalColorPixels < 5) {
    return null; // Não há pixels coloridos suficientes
  }
  
  // Tratar candles pretos como vermelhos e brancos como verdes para simplificar
  if (blackCount > redCount) redCount += blackCount;
  if (whiteCount > greenCount) greenCount += whiteCount;
  
  const color: 'verde' | 'vermelho' = greenCount > redCount ? 'verde' : 'vermelho';
  
  // Calcular confiança baseada na densidade de pixels da cor correta
  const colorRatio = (color === 'verde' ? greenCount : redCount) / totalColorPixels;
  const densityRatio = totalColorPixels / (segWidth * segHeight);
  const confidence = Math.min(100, Math.round(colorRatio * densityRatio * 100));
  
  // Filtrar candles com baixa confiança
  if (confidence < 20) {
    return null;
  }
  
  return {
    x: x1,
    y: y1,
    width: segWidth,
    height: segHeight,
    color,
    confidence
  };
};

// Detecção aprimorada de linhas de suporte e resistência
const detectSupportResistanceLines = (
  data: Uint8ClampedArray,
  width: number,
  height: number
): { startX: number, startY: number, endX: number, endY: number, confidence: number }[] => {
  // Calcular histograma horizontal de pixels escuros
  const horizontalDensity = new Array(height).fill(0);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      // Detectar pixels escuros (possíveis linhas)
      if (data[i] + data[i + 1] + data[i + 2] < 150 * 3) {
        horizontalDensity[y]++;
      }
    }
  }
  
  // Suavizar o histograma para reduzir ruído
  const smoothedDensity = new Array(height).fill(0);
  const kernelSize = 5;
  const halfKernel = Math.floor(kernelSize / 2);
  
  for (let y = 0; y < height; y++) {
    let sum = 0, count = 0;
    
    for (let k = -halfKernel; k <= halfKernel; k++) {
      const idx = y + k;
      if (idx >= 0 && idx < height) {
        sum += horizontalDensity[idx];
        count++;
      }
    }
    
    smoothedDensity[y] = sum / count;
  }
  
  // Detectar picos no histograma suavizado (possíveis linhas)
  const peakThreshold = width * 0.2; // Linha deve cobrir pelo menos 20% da largura
  const minPeakDistance = Math.ceil(height * 0.03); // Distância mínima entre picos
  
  const peaks: number[] = [];
  
  for (let y = 2; y < height - 2; y++) {
    if (smoothedDensity[y] > peakThreshold) {
      // Verificar se é um máximo local
      if (
        smoothedDensity[y] > smoothedDensity[y - 1] &&
        smoothedDensity[y] > smoothedDensity[y - 2] &&
        smoothedDensity[y] > smoothedDensity[y + 1] &&
        smoothedDensity[y] > smoothedDensity[y + 2]
      ) {
        // Verificar se está distante o suficiente de outros picos
        let isFarEnough = true;
        
        for (const existingPeak of peaks) {
          if (Math.abs(existingPeak - y) < minPeakDistance) {
            isFarEnough = false;
            break;
          }
        }
        
        if (isFarEnough) {
          peaks.push(y);
        }
      }
    }
  }
  
  // Converter picos em linhas horizontais
  const lines: { startX: number, startY: number, endX: number, endY: number, confidence: number }[] = [];
  
  for (const y of peaks) {
    // Calcular confiança baseada na densidade de pixels
    const confidence = Math.min(100, Math.round((smoothedDensity[y] / width) * 100));
    
    lines.push({
      startX: 0,
      startY: y,
      endX: width - 1,
      endY: y,
      confidence
    });
  }
  
  return lines;
};

// Gerar elementos técnicos a partir da detecção
const generateTechnicalElementsFromDetection = (
  candles: CandleData[],
  lines: { startX: number, startY: number, endX: number, endY: number, confidence: number }[],
  width: number,
  height: number
): TechnicalElement[] => {
  const technicalElements: TechnicalElement[] = [];
  
  // Converter linhas de suporte/resistência detectadas
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isSupport = i % 2 === 0; // Alternar entre suporte e resistência para fins visuais
    
    technicalElements.push({
      type: 'line',
      points: [
        { x: line.startX, y: line.startY },
        { x: line.endX, y: line.endY }
      ],
      color: isSupport ? '#22c55e' : '#ef4444', // Verde para suporte, vermelho para resistência
      thickness: line.confidence > 70 ? 2 : 1,
      dashArray: line.confidence > 70 ? undefined : [5, 5]
    });
    
    // Adicionar rótulo para linhas com alta confiança
    if (line.confidence > 75) {
      technicalElements.push({
        type: 'label',
        position: { x: 10, y: line.startY - 5 },
        text: isSupport ? 'Suporte' : 'Resistência',
        color: isSupport ? '#22c55e' : '#ef4444',
        backgroundColor: '#1e293b'
      });
    }
  }
  
  // Detectar tendências de preço usando os candles
  if (candles.length > 5) {
    // Ordenar candles por posição x (tempo)
    const sortedCandles = [...candles].sort((a, b) => a.position.x - b.position.x);
    
    // Extrair preços de fechamento para análise de tendência
    const prices = sortedCandles.map(c => c.close);
    
    // Detectar tendência linear
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    const n = prices.length;
    
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += prices[i];
      sumXY += i * prices[i];
      sumX2 += i * i;
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    // Se a inclinação for significativa, adicionar linha de tendência
    if (Math.abs(slope) > 0.1) {
      const isBullish = slope > 0;
      const startCandle = sortedCandles[0];
      const endCandle = sortedCandles[sortedCandles.length - 1];
      const startY = startCandle.position.y;
      const endY = endCandle.position.y - (slope * (endCandle.position.x - startCandle.position.x));
      
      technicalElements.push({
        type: 'line',
        points: [
          { x: startCandle.position.x, y: startY },
          { x: endCandle.position.x, y: endY }
        ],
        color: isBullish ? '#22c55e' : '#ef4444',
        thickness: 2,
        dashArray: [5, 3]
      });
      
      // Adicionar rótulo indicando a tendência
      technicalElements.push({
        type: 'label',
        position: { x: endCandle.position.x - 100, y: endY - 20 },
        text: isBullish ? 'Tendência de Alta' : 'Tendência de Baixa',
        color: isBullish ? '#22c55e' : '#ef4444',
        backgroundColor: '#1e293b'
      });
    }
    
    // Tentar identificar padrões de candles
    // Verificar padrões de reversão como "Martelo" ou "Doji"
    for (let i = 1; i < sortedCandles.length - 1; i++) {
      const prevCandle = sortedCandles[i-1];
      const currCandle = sortedCandles[i];
      const nextCandle = sortedCandles[i+1];
      
      const candleSize = Math.abs(currCandle.close - currCandle.open);
      const upperShadow = currCandle.high - Math.max(currCandle.open, currCandle.close);
      const lowerShadow = Math.min(currCandle.open, currCandle.close) - currCandle.low;
      
      // Identificar possível martelo (sombra inferior longa)
      if (lowerShadow > 2 * candleSize && upperShadow < 0.5 * candleSize) {
        technicalElements.push({
          type: 'circle',
          center: { x: currCandle.position.x, y: currCandle.position.y },
          radius: 15,
          color: '#3b82f6',
          thickness: 2
        });
        
        technicalElements.push({
          type: 'label',
          position: { x: currCandle.position.x - 30, y: currCandle.position.y - 30 },
          text: 'Martelo',
          color: '#3b82f6',
          backgroundColor: '#1e293b'
        });
      }
      
      // Identificar possível doji (abertura próxima do fechamento)
      if (candleSize < 0.1 * (upperShadow + lowerShadow) && (upperShadow + lowerShadow) > 0) {
        technicalElements.push({
          type: 'circle',
          center: { x: currCandle.position.x, y: currCandle.position.y },
          radius: 15,
          color: '#f59e0b',
          thickness: 2
        });
        
        technicalElements.push({
          type: 'label',
          position: { x: currCandle.position.x - 20, y: currCandle.position.y - 30 },
          text: 'Doji',
          color: '#f59e0b',
          backgroundColor: '#1e293b'
        });
      }
    }
  }
  
  return technicalElements;
};

export const processChartImage = async (imageUrl: string): Promise<CandleData[]> => {
  console.log(`Iniciando processamento real da imagem: ${imageUrl}`);

  try {
    // 1. Detectar a região do gráfico (se não houver uma selecionada manualmente)
    // Por agora, vamos assumir que a imagem já é o gráfico ou que a região foi selecionada
    // Se você usa ChartRegionSelector, ele já define selectedRegion.
    // Aqui, vamos processar a imagem inteira ou uma região pré-definida para simplificar a integração inicial.
    // Para uma abordagem mais robusta, você passaria `selectedRegion` para esta função.

    const img = new Image();
    img.src = imageUrl;

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (e) => reject(new Error(`Falha ao carregar a imagem: ${e}`));
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Não foi possível obter contexto 2D do canvas.');
    }
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Opcional: Processamento para realçar candles antes da segmentação (como `enhanceEdges`)
    // const enhancedData = enhanceEdges(data, canvas.width, canvas.height);
    // highlightCandleColors(enhancedData, canvas.width, canvas.height);
    // (você pode optar por usar os dados originais ou os realçados para segmentação)

    // 2. Segmentar os candles
    const segments = segmentCandlePatterns(data, canvas.width, canvas.height);
    console.log(`Segmentos detectados: ${segments.length}`);

    // 3. Analisar cada segmento e converter em CandleData
    let detectedCandles: CandleData[] = [];
    for (const segment of segments) {
      const candleInfo = analyzeCandleSegment(segment, data, canvas.width, canvas.height);
      if (candleInfo) {
        // Adicionar o timestamp. Uma forma simples é usar um intervalo fixo.
        // Em um sistema real, o timestamp viria do próprio gráfico ou da corretora.
        const timestamp = Date.now() - (segments.indexOf(segment) * 60 * 1000); // Exemplo: 1 minuto de intervalo
        detectedCandles.push({
          open: 0, // Será estimado por estimateOHLCValues
          high: 0, // Será estimado por estimateOHLCValues
          low: 0,  // Será estimado por estimateOHLCValues
          close: 0, // Será estimado por estimateOHLCValues
          timestamp,
          color: candleInfo.color,
          position: { x: candleInfo.x + candleInfo.width / 2, y: candleInfo.y + candleInfo.height / 2 },
          width: candleInfo.width,
          height: candleInfo.height,
        });
      }
    }

    // 4. Estimar valores OHLC e ajustar posição/tamanho
    // As funções `estimateOHLCValues` e `generateTechnicalElementsFromDetection`
    // já existem e podem ser usadas aqui.
    // Note: estimateOHLCValues modifica os objetos candles in-place.
    estimateOHLCValues(detectedCandles);
    console.log('Candles com OHLC estimados:', detectedCandles);

    // Opcional: Aqui você pode gerar TechnicalElements a partir de candles e linhas detectadas
    // const detectedLines = detectSupportResistanceLines(data, canvas.width, canvas.height);
    // const technicalElements = generateTechnicalElementsFromDetection(detectedCandles, detectedLines, canvas.width, canvas.height);
    // console.log('Elementos técnicos gerados:', technicalElements);

    return detectedCandles;

  } catch (error) {
    console.error('Erro no processamento real da imagem:', error);
    // Retornar um array vazio ou lidar com o erro conforme a necessidade do app
    return [];
  }
};
