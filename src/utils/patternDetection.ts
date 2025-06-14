
import { PatternResult, AnalysisResult, VolumeData, VolatilityData, TechnicalIndicator, ScalpingSignal, CandleData } from "../context/AnalyzerContext";
import { analyzeVolume } from "./volumeAnalysis";
import { analyzeVolatility } from "./volatilityAnalysis";
import { analyzePriceAction, analyzeMarketContext } from "./priceActionAnalysis";
import { performConfluenceAnalysis } from "./confluenceAnalysis";
import { detectDivergences } from "./divergenceAnalysis";
import { detectChartPatterns } from "./chartPatternDetection";
import { detectCandlestickPatterns } from "./candlestickPatternDetection";
import { detectTechnicalIndicators } from "./technicalIndicatorAnalysis";
import { DetectedPattern } from "./types";
import { 
  analyzeAdvancedMarketConditions, 
  calculateOperatingScore, 
  calculateConfidenceReduction,
  EnhancedMarketContext
} from "./advancedMarketContext";
import { extractRealCandlesFromImage } from "./realCandleExtraction";

interface AnalysisOptions {
  timeframe?: '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';
  optimizeForScalping?: boolean;
  considerVolume?: boolean;
  considerVolatility?: boolean;
  enableCandleDetection?: boolean;
  scalpingStrategy?: string;
  marketContextEnabled?: boolean;
  marketAnalysisDepth?: string;
  isLiveAnalysis?: boolean;
  useConfluences?: boolean;
  enablePriceAction?: boolean;
  enableMarketContext?: boolean;
}

// NOVA FUNÇÃO: Extração real de candles da imagem
export const detectCandles = async (imageData: string, width: number, height: number): Promise<CandleData[]> => {
  console.log('🔍 Extraindo candles REAIS da imagem capturada...');
  
  try {
    const realCandles = await extractRealCandlesFromImage(imageData);
    console.log(`✅ ${realCandles.length} candles reais extraídos da imagem`);
    
    // Validação dos dados extraídos
    if (realCandles.length === 0) {
      console.warn('⚠️ Nenhum candle detectado - verifique se a imagem contém um gráfico válido');
      return [];
    }
    
    // Verificar integridade dos dados OHLC
    const validCandles = realCandles.filter(candle => {
      const isValid = candle.open > 0 && candle.high > 0 && candle.low > 0 && candle.close > 0 &&
                     candle.high >= Math.max(candle.open, candle.close) &&
                     candle.low <= Math.min(candle.open, candle.close);
      
      if (!isValid) {
        console.warn('⚠️ Candle com dados OHLC inválidos detectado:', candle);
      }
      
      return isValid;
    });
    
    console.log(`📊 ${validCandles.length} candles válidos após verificação de integridade`);
    return validCandles;
  } catch (error) {
    console.error('❌ Erro ao extrair candles reais:', error);
    return [];
  }
};

// NOVA FUNÇÃO: Detectar padrões reais baseados nos candles extraídos
export const detectPatterns = async (imageData: string): Promise<PatternResult[]> => {
  console.log('🔍 Detectando padrões REAIS dos candles extraídos...');
  
  const candles = await detectCandles(imageData, 1280, 720);
  
  if (candles.length === 0) {
    console.log('❌ Nenhum candle extraído - não é possível detectar padrões');
    return [];
  }
  
  // Detectar padrões de candlestick reais
  const candlePatterns = detectCandlestickPatterns(candles);
  
  // Converter para PatternResult
  return candlePatterns.map(pattern => ({
    type: pattern.type,
    confidence: pattern.confidence,
    description: pattern.description,
    recommendation: `Sinal de ${pattern.action}`,
    action: pattern.action
  }));
};

export const generateTechnicalMarkup = (patterns: PatternResult[], width: number, height: number) => {
  return patterns.map((pattern, index) => ({
    id: `pattern-${index}`,
    type: 'pattern' as const,
    patternType: pattern.type as any,
    points: [{ x: Math.random() * width * 0.8, y: Math.random() * height * 0.8 }],
    color: '#ff0000',
    pattern: pattern.type,
    confidence: pattern.confidence
  }));
};

// FUNÇÃO PRINCIPAL: Análise REAL com dados extraídos da imagem
export const analyzeChart = async (imageData: string, options: AnalysisOptions = {}): Promise<AnalysisResult> => {
  console.log('🚀 Iniciando análise REAL do gráfico capturado...');
  
  // Extrair candles REAIS da imagem capturada
  const candles = await extractRealCandlesFromImage(imageData);
  
  if (candles.length === 0) {
    console.log('❌ ERRO: Nenhum candle extraído da imagem. Verifique se a imagem contém um gráfico de candles válido.');
    return {
      patterns: [],
      timestamp: Date.now(),
      imageUrl: imageData,
      technicalElements: [],
      candles: [],
      scalpingSignals: [],
      technicalIndicators: [],
      volumeData: {
        value: 0,
        trend: 'neutral',
        abnormal: false,
        significance: 'low',
        relativeToAverage: 1,
        distribution: 'neutral',
        divergence: false
      },
      volatilityData: {
        value: 0,
        trend: 'neutral',
        atr: 0,
        percentageRange: 0,
        isHigh: false,
        historicalComparison: 'average',
        impliedVolatility: 0
      },
      marketContext: {
        phase: 'indefinida',
        strength: 'fraca',
        dominantTimeframe: '1m',
        sentiment: 'neutro',
        description: 'Nenhum candle detectado na imagem',
        marketStructure: 'indefinida',
        breakoutPotential: 'baixo',
        momentumSignature: 'estável',
        advancedConditions: {
          recommendation: 'nao_operar',
          warnings: ['Dados insuficientes - imagem não contém candles detectáveis'],
          timeBasedFactors: {},
          marketPhaseAnalysis: {},
          volatilityProfile: {},
          liquidityConditions: {},
          institutionalActivity: {}
        },
        operatingScore: 0,
        confidenceReduction: 1
      },
      warnings: ['Nenhum candle detectado na imagem capturada'],
      preciseEntryAnalysis: {
        exactMinute: 'reversão',
        entryType: 'reversão',
        nextCandleExpectation: 'reversão',
        priceAction: 'reversão',
        confirmationSignal: 'reversão',
        riskRewardRatio: 0,
        entryInstructions: 'Dados insuficientes - aponte a câmera para um gráfico de candles válido'
      },
      confluences: {
        confluenceScore: 0,
        supportResistance: [],
        criticalLevels: [],
        marketStructure: {
          structure: 'lateral',
          strength: 0
        },
        priceAction: {
          trend: 'lateral',
          momentum: 'neutro',
          strength: 0
        }
      },
      priceActionSignals: [],
      detailedMarketContext: {
        phase: 'indefinida',
        sentiment: 'neutro',
        strength: 'fraca',
        description: 'Sem dados válidos',
        marketStructure: 'indefinida',
        breakoutPotential: 'baixo',
        momentumSignature: 'estável',
        institutionalBias: 'neutro',
        volatilityState: 'indefinida',
        liquidityCondition: 'indefinida',
        timeOfDay: 'indefinido',
        trend: 'lateral'
      },
      entryRecommendations: []
    };
  }

  console.log(`📊 Analisando ${candles.length} candles REAIS extraídos da imagem`);
  
  // Validação crítica dos dados OHLC
  let validCandles = candles.filter(candle => {
    const isValid = candle.open > 0 && candle.high > 0 && candle.low > 0 && candle.close > 0 &&
                   candle.high >= Math.max(candle.open, candle.close) &&
                   candle.low <= Math.min(candle.open, candle.close) &&
                   candle.position && candle.position.x >= 0 && candle.position.y >= 0;
    
    if (!isValid) {
      console.warn('🚨 Candle com dados inválidos removido da análise:', candle);
    }
    
    return isValid;
  });
  
  if (validCandles.length < candles.length) {
    console.warn(`⚠️ ${candles.length - validCandles.length} candles removidos por dados inválidos`);
  }
  
  if (validCandles.length === 0) {
    console.error('❌ Todos os candles extraídos possuem dados inválidos');
    validCandles = candles; // Usar dados originais mesmo com problemas
  }
  
  console.log(`✅ Usando ${validCandles.length} candles válidos para análise`);
  
  // Análise avançada de condições de mercado (COM DADOS REAIS)
  const advancedConditions = analyzeAdvancedMarketConditions(validCandles);
  const operatingScore = calculateOperatingScore(advancedConditions);
  const confidenceReduction = calculateConfidenceReduction(advancedConditions);
  
  console.log(`🎯 Score de operação: ${operatingScore}/100`);
  console.log(`⚠️ Redução de confiança: ${(confidenceReduction * 100).toFixed(0)}%`);
  console.log(`📋 Recomendação: ${advancedConditions.recommendation}`);
  
  if (advancedConditions.warnings.length > 0) {
    console.log('🚨 Warnings:', advancedConditions.warnings);
  }
  
  // Análise de volatilidade (COM DADOS REAIS)
  const volatilityAnalysis = analyzeVolatility(validCandles);
  console.log(`📈 Volatilidade: ${volatilityAnalysis.value.toFixed(2)}% (trend: ${volatilityAnalysis.trend})`);
  
  // Detectar padrões reais dos candles extraídos
  const patterns: PatternResult[] = [];
  
  // Padrões de candlestick (COM DADOS REAIS)
  let candlePatterns: DetectedPattern[] = [];
  if (options.enableCandleDetection !== false && validCandles.length > 0) {
    candlePatterns = detectCandlestickPatterns(validCandles);
    console.log(`🕯️ Padrões de candlestick detectados: ${candlePatterns.length}`);
    
    // Converter padrões de candle para PatternResult
    candlePatterns.forEach(pattern => {
      patterns.push({
        type: pattern.type,
        confidence: pattern.confidence * confidenceReduction,
        description: pattern.description,
        recommendation: `Considerar ${pattern.action}`,
        action: pattern.action
      });
    });
  }
  
  // Padrões gráficos (COM DADOS REAIS)
  if (validCandles.length > 0) {
    const chartPatternTypes = ['triangulo', 'suporte_resistencia', 'canal', 'rompimento'];
    
    for (const patternType of chartPatternTypes) {
      const detectedPatterns = await detectChartPatterns(validCandles, patternType, options);
      
      detectedPatterns.forEach(pattern => {
        patterns.push({
          type: pattern.pattern,
          confidence: pattern.confidence * confidenceReduction,
          description: pattern.description,
          recommendation: pattern.recommendation,
          action: pattern.action,
        });
      });
    }
  }
  
  // Aplicar warnings se as condições são ruins
  patterns.forEach(pattern => {
    if (operatingScore < 30) {
      pattern.description += ` ⚠️ CUIDADO: Condições adversas de mercado (Score: ${operatingScore}/100)`;
    }
  });
  
  // Price action analysis (COM DADOS REAIS)
  const priceActionSignals = validCandles.length > 0 ? analyzePriceAction(validCandles) : [];
  console.log(`⚡️ Price Action Signals: ${priceActionSignals.length} signals detected`);
  
  // Volume analysis (COM DADOS REAIS)
  const volumeData: VolumeData = validCandles.length > 0 ? analyzeVolume(validCandles) : {
    value: 0,
    trend: 'neutral',
    abnormal: false,
    significance: 'low',
    relativeToAverage: 1,
    distribution: 'neutral',
    divergence: false
  };
  console.log(`📊 Volume Analysis: Trend - ${volumeData.trend}, Significance - ${volumeData.significance}`);
  
  // Divergence analysis (COM DADOS REAIS)
  const divergences = validCandles.length > 0 ? detectDivergences(validCandles) : [];
  console.log(`🔍 Divergências encontradas: ${divergences.length}`);
  
  // Technical indicators (COM DADOS REAIS)
  const technicalIndicators: TechnicalIndicator[] = validCandles.length > 0 ? detectTechnicalIndicators(validCandles) : [];
  console.log(`⚙️ Indicadores técnicos detectados: ${technicalIndicators.length}`);
  
  // Scalping signals (COM DADOS REAIS)
  const scalpingSignals: ScalpingSignal[] = candlePatterns.map(signal => ({
    type: 'entrada',
    action: signal.action === 'compra' ? 'compra' : 'venda',
    price: validCandles.length > 0 ? validCandles[validCandles.length - 1].close.toFixed(5) : '0.00000',
    confidence: signal.confidence,
    timeframe: options.timeframe || '1m',
    description: signal.description,
  }));
  console.log(`⚡️ Scalping Signals: ${scalpingSignals.length} signals detected`);
  
  // Market context (COM DADOS REAIS)
  const marketContextAnalysis = validCandles.length > 0 ? analyzeMarketContext(validCandles) : {
    phase: 'consolidacao' as const,
    sentiment: 'neutro' as const,
    volatilityState: 'normal' as const,
    liquidityCondition: 'normal' as const,
    institutionalBias: 'neutro' as const,
    timeOfDay: 'meio_dia' as const,
    marketStructure: {
      trend: 'lateral' as const,
      strength: 50,
      breakouts: false,
      pullbacks: false
    }
  };
  console.log(`🌎 Market Context: Phase - ${marketContextAnalysis.phase}, Sentiment - ${marketContextAnalysis.sentiment}`);
  
  // Confluence analysis (COM DADOS REAIS)
  const confluenceAnalysis = validCandles.length > 0 ? performConfluenceAnalysis(validCandles, candlePatterns) : {
    confluenceScore: 0,
    supportResistance: [],
    criticalLevels: [],
    marketStructure: { structure: 'lateral', strength: 0 },
    priceAction: { trend: 'lateral', momentum: 'neutro', strength: 0 }
  };
  console.log(`🤝 Confluence Score: ${confluenceAnalysis.confluenceScore}`);
  
  // Contexto de mercado aprimorado (COM DADOS REAIS)
  const enhancedMarketContext: EnhancedMarketContext = {
    phase: 'indefinida',
    strength: 'fraca',
    dominantTimeframe: options.timeframe || '1m',
    sentiment: 'neutro',
    description: `Score: ${operatingScore}/100 - ${validCandles.length} candles analisados`,
    marketStructure: 'indefinida',
    breakoutPotential: 'baixo',
    momentumSignature: 'estável',
    advancedConditions,
    operatingScore,
    confidenceReduction
  };
  
  const currentPrice = validCandles.length > 0 ? validCandles[validCandles.length - 1].close : 0;
  
  return {
    patterns,
    timestamp: Date.now(),
    imageUrl: imageData,
    technicalElements: [],
    candles: validCandles,
    scalpingSignals: scalpingSignals,
    technicalIndicators: technicalIndicators,
    volumeData: volumeData,
    volatilityData: volatilityAnalysis,
    marketContext: enhancedMarketContext,
    warnings: advancedConditions.warnings,
    preciseEntryAnalysis: {
      exactMinute: patterns.length > 0 ? 'confirmacao' : 'aguardar',
      entryType: patterns.length > 0 ? 'breakout' : 'reversão',
      nextCandleExpectation: patterns.length > 0 ? 'continuacao' : 'reversão',
      priceAction: priceActionSignals.length > 0 ? 'forte' : 'fraco',
      confirmationSignal: patterns.length > 0 ? 'confirmado' : 'pendente',
      riskRewardRatio: patterns.length > 0 ? 2.5 : 0,
      entryInstructions: patterns.length > 0 ? 
        `Entry próximo de ${currentPrice.toFixed(5)}` : 
        'Aguardar melhor setup'
    },
    confluences: confluenceAnalysis,
    priceActionSignals: priceActionSignals,
    detailedMarketContext: {
      phase: marketContextAnalysis.phase,
      sentiment: marketContextAnalysis.sentiment,
      strength: patterns.length > 0 ? 'forte' : 'fraca',
      description: `${patterns.length} padrões detectados em ${validCandles.length} candles reais`,
      marketStructure: 'definida',
      breakoutPotential: patterns.length > 0 ? 'alto' : 'baixo',
      momentumSignature: volatilityAnalysis.isHigh ? 'volatil' : 'estavel',
      institutionalBias: marketContextAnalysis.institutionalBias,
      volatilityState: marketContextAnalysis.volatilityState,
      liquidityCondition: marketContextAnalysis.liquidityCondition,
      timeOfDay: marketContextAnalysis.timeOfDay,
      trend: marketContextAnalysis.marketStructure.trend
    },
    entryRecommendations: patterns.slice(0, 3).map(p => ({
      type: p.action,
      confidence: p.confidence,
      description: p.description,
      price: currentPrice.toFixed(5)
    }))
  };
};
