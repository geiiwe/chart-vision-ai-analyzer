
import { CandleData } from "../context/AnalyzerContext";

export interface M1ContextValidation {
  isValidForEntry: boolean;
  rejectionReasons: string[];
  contextScore: number;
  trendDirection: 'alta' | 'baixa' | 'lateral';
  pullbackDetected: boolean;
  strongCandleConfirmation: boolean;
  supportResistanceLevel: boolean;
  volumeConfirmation: boolean;
  spaceToRun: boolean;
  indecisionCandles: boolean;
  recommendation: 'enter' | 'wait' | 'skip';
}

// Sistema de validação M1 - trabalha junto com o tracking existente
export const validateM1Context = (
  candles: CandleData[],
  signal: 'compra' | 'venda' | 'neutro',
  priceActionSignals?: any[],
  volumeData?: any,
  confluences?: any
): M1ContextValidation => {
  
  if (candles.length < 20 || signal === 'neutro') {
    return {
      isValidForEntry: false,
      rejectionReasons: ['Dados insuficientes ou sinal neutro'],
      contextScore: 0,
      trendDirection: 'lateral',
      pullbackDetected: false,
      strongCandleConfirmation: false,
      supportResistanceLevel: false,
      volumeConfirmation: false,
      spaceToRun: false,
      indecisionCandles: true,
      recommendation: 'skip'
    };
  }

  const rejectionReasons: string[] = [];
  let contextScore = 0;
  
  // 1. Detectar tendência (últimos 10 candles)
  const trendDirection = detectTrend(candles.slice(-10));
  
  // Regra: Não entra em lateralização
  if (trendDirection === 'lateral') {
    rejectionReasons.push('Preço em lateralização - mercado sem direção');
    return {
      isValidForEntry: false,
      rejectionReasons,
      contextScore: 0,
      trendDirection,
      pullbackDetected: false,
      strongCandleConfirmation: false,
      supportResistanceLevel: false,
      volumeConfirmation: false,
      spaceToRun: false,
      indecisionCandles: true,
      recommendation: 'skip'
    };
  }
  
  contextScore += 25; // Tendência definida
  
  // 2. Detectar pullback válido
  const pullbackDetected = detectPullback(candles.slice(-5), trendDirection);
  if (pullbackDetected) {
    contextScore += 20;
  }
  
  // 3. Verificar candle de confirmação forte
  const strongCandleConfirmation = checkStrongCandleConfirmation(candles.slice(-3), signal);
  if (strongCandleConfirmation) {
    contextScore += 25;
  } else {
    rejectionReasons.push('Candle de confirmação fraco ou ausente');
  }
  
  // 4. Verificar candles de indecisão (pavios dos dois lados)
  const indecisionCandles = checkIndecisionCandles(candles.slice(-3));
  if (indecisionCandles) {
    rejectionReasons.push('Candles de indecisão detectados (pavios dos dois lados)');
    contextScore -= 30;
  }
  
  // 5. Verificar nível de suporte/resistência
  const supportResistanceLevel = checkSupportResistanceLevel(candles, signal, confluences);
  if (supportResistanceLevel) {
    contextScore += 20;
  }
  
  // 6. Confirmar volume
  const volumeConfirmation = checkVolumeConfirmation(volumeData, signal);
  if (volumeConfirmation) {
    contextScore += 15;
  }
  
  // 7. Verificar espaço para correr
  const spaceToRun = checkSpaceToRun(candles, signal, confluences);
  if (!spaceToRun) {
    rejectionReasons.push('Sem espaço suficiente para o preço correr');
    contextScore -= 25;
  }
  
  // 8. Verificar se trend e signal estão alinhados
  const trendSignalAlignment = checkTrendSignalAlignment(trendDirection, signal);
  if (!trendSignalAlignment) {
    rejectionReasons.push('Sinal contra a tendência principal');
    contextScore -= 20;
  } else {
    contextScore += 10;
  }
  
  // Determinar recomendação final
  let recommendation: 'enter' | 'wait' | 'skip' = 'skip';
  
  if (contextScore >= 70 && rejectionReasons.length === 0) {
    recommendation = 'enter';
  } else if (contextScore >= 50 && rejectionReasons.length <= 1) {
    recommendation = 'wait';
  }
  
  const isValidForEntry = recommendation === 'enter';
  
  return {
    isValidForEntry,
    rejectionReasons,
    contextScore: Math.max(0, Math.min(100, contextScore)),
    trendDirection,
    pullbackDetected,
    strongCandleConfirmation,
    supportResistanceLevel,
    volumeConfirmation,
    spaceToRun,
    indecisionCandles,
    recommendation
  };
};

// Detectar tendência nos últimos candles
const detectTrend = (candles: CandleData[]): 'alta' | 'baixa' | 'lateral' => {
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  
  const firstClose = closes[0];
  const lastClose = closes[closes.length - 1];
  const priceChange = ((lastClose - firstClose) / firstClose) * 100;
  
  // Verificar se há movimento lateral (variação pequena)
  const maxHigh = Math.max(...highs);
  const minLow = Math.min(...lows);
  const range = ((maxHigh - minLow) / lastClose) * 100;
  
  // Se range muito pequeno, é lateral
  if (range < 0.1 || Math.abs(priceChange) < 0.05) {
    return 'lateral';
  }
  
  return priceChange > 0.05 ? 'alta' : 'baixa';
};

// Detectar pullback válido
const detectPullback = (candles: CandleData[], trendDirection: 'alta' | 'baixa' | 'lateral'): boolean => {
  if (candles.length < 3 || trendDirection === 'lateral') return false;
  
  const recent3 = candles.slice(-3);
  
  if (trendDirection === 'alta') {
    // Em tendência de alta, procurar correção de baixa seguida de retomada
    const hasCorrection = recent3[0].close > recent3[1].close;
    const hasResumption = recent3[2].close > recent3[1].close;
    return hasCorrection && hasResumption;
  } else {
    // Em tendência de baixa, procurar correção de alta seguida de retomada
    const hasCorrection = recent3[0].close < recent3[1].close;
    const hasResumption = recent3[2].close < recent3[1].close;
    return hasCorrection && hasResumption;
  }
};

// Verificar candle de confirmação forte
const checkStrongCandleConfirmation = (candles: CandleData[], signal: 'compra' | 'venda'): boolean => {
  if (candles.length === 0) return false;
  
  const lastCandle = candles[candles.length - 1];
  const body = Math.abs(lastCandle.close - lastCandle.open);
  const totalRange = lastCandle.high - lastCandle.low;
  const bodyRatio = body / totalRange;
  
  // Candle forte: corpo representa pelo menos 60% do range total
  const isStrongCandle = bodyRatio >= 0.6;
  
  // Verificar se direção do candle alinha com o sinal
  const candleDirection = lastCandle.close > lastCandle.open ? 'compra' : 'venda';
  const directionAlignment = candleDirection === signal;
  
  return isStrongCandle && directionAlignment;
};

// Verificar candles de indecisão (pavios dos dois lados)
const checkIndecisionCandles = (candles: CandleData[]): boolean => {
  if (candles.length === 0) return false;
  
  let indecisionCount = 0;
  
  for (const candle of candles) {
    const body = Math.abs(candle.close - candle.open);
    const upperWick = candle.high - Math.max(candle.open, candle.close);
    const lowerWick = Math.min(candle.open, candle.close) - candle.low;
    const totalRange = candle.high - candle.low;
    
    // Candle de indecisão: pavios dos dois lados representam mais que o corpo
    const hasLargeUpperWick = upperWick > body * 0.8;
    const hasLargeLowerWick = lowerWick > body * 0.8;
    const smallBody = body < totalRange * 0.4;
    
    if (hasLargeUpperWick && hasLargeLowerWick && smallBody) {
      indecisionCount++;
    }
  }
  
  // Se mais de 1 candle de indecisão nos últimos 3, é problemático
  return indecisionCount >= 2;
};

// Verificar nível de suporte/resistência
const checkSupportResistanceLevel = (candles: CandleData[], signal: 'compra' | 'venda', confluences?: any): boolean => {
  if (!confluences || !confluences.supportResistance) return false;
  
  const currentPrice = candles[candles.length - 1].close;
  
  // Procurar níveis próximos (dentro de 0.1% do preço atual)
  const nearbyLevels = confluences.supportResistance.filter((level: any) => {
    const distance = Math.abs((level.price - currentPrice) / currentPrice) * 100;
    return distance <= 0.1; // Dentro de 0.1%
  });
  
  if (nearbyLevels.length === 0) return false;
  
  // Verificar se há nível apropriado para o sinal
  for (const level of nearbyLevels) {
    if (signal === 'compra' && level.type === 'support' && level.strength === 'forte') {
      return true;
    }
    if (signal === 'venda' && level.type === 'resistance' && level.strength === 'forte') {
      return true;
    }
  }
  
  return false;
};

// Verificar confirmação de volume
const checkVolumeConfirmation = (volumeData?: any, signal?: 'compra' | 'venda'): boolean => {
  if (!volumeData) return false;
  
  // Volume anormal e crescente é positivo
  return volumeData.abnormal && volumeData.trend === 'increasing';
};

// Verificar espaço para o preço correr
const checkSpaceToRun = (candles: CandleData[], signal: 'compra' | 'venda', confluences?: any): boolean => {
  const currentPrice = candles[candles.length - 1].close;
  
  if (!confluences || !confluences.supportResistance) return true; // Se não há níveis, assume que há espaço
  
  const relevantLevels = confluences.supportResistance.filter((level: any) => {
    if (signal === 'compra') {
      return level.type === 'resistance' && level.price > currentPrice;
    } else {
      return level.type === 'support' && level.price < currentPrice;
    }
  });
  
  if (relevantLevels.length === 0) return true; // Sem obstáculos próximos
  
  // Encontrar nível mais próximo
  const nearestLevel = relevantLevels.reduce((nearest: any, current: any) => {
    const nearestDistance = Math.abs(nearest.price - currentPrice);
    const currentDistance = Math.abs(current.price - currentPrice);
    return currentDistance < nearestDistance ? current : nearest;
  });
  
  // Verificar se há espaço suficiente (pelo menos 0.15% de distância)
  const distance = Math.abs((nearestLevel.price - currentPrice) / currentPrice) * 100;
  return distance >= 0.15;
};

// Verificar alinhamento entre tendência e sinal
const checkTrendSignalAlignment = (trendDirection: 'alta' | 'baixa' | 'lateral', signal: 'compra' | 'venda'): boolean => {
  if (trendDirection === 'lateral') return false;
  
  return (trendDirection === 'alta' && signal === 'compra') || 
         (trendDirection === 'baixa' && signal === 'venda');
};

// Função de log para debugging
export const logM1ContextValidation = (validation: M1ContextValidation, signal: string) => {
  console.log('🎯 VALIDAÇÃO M1 CONTEXT:');
  console.log(`   Sinal: ${signal} | Válido: ${validation.isValidForEntry ? '✅' : '❌'}`);
  console.log(`   Score: ${validation.contextScore}% | Recomendação: ${validation.recommendation.toUpperCase()}`);
  console.log(`   Tendência: ${validation.trendDirection} | Pullback: ${validation.pullbackDetected ? 'SIM' : 'NÃO'}`);
  console.log(`   Candle Forte: ${validation.strongCandleConfirmation ? 'SIM' : 'NÃO'} | Indecisão: ${validation.indecisionCandles ? 'SIM' : 'NÃO'}`);
  console.log(`   S/R Nível: ${validation.supportResistanceLevel ? 'SIM' : 'NÃO'} | Volume: ${validation.volumeConfirmation ? 'SIM' : 'NÃO'}`);
  console.log(`   Espaço: ${validation.spaceToRun ? 'SIM' : 'NÃO'}`);
  
  if (validation.rejectionReasons.length > 0) {
    console.log('🚫 Motivos de Rejeição M1:');
    validation.rejectionReasons.forEach(reason => console.log(`   • ${reason}`));
  }
};
