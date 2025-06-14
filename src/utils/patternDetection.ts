
import { PatternResult, AnalysisResult, VolumeData, VolatilityData, TechnicalIndicator, ScalpingSignal } from "../context/AnalyzerContext";
import { mockCandles as generateMockCandles } from "./mockData";
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

interface AnalysisOptions {
  timeframe?: '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';
  optimizeForScalping?: boolean;
  considerVolume?: boolean;
  considerVolatility?: boolean;
  enableCandleDetection?: boolean;
}

export const analyzeChart = async (imageData: string, options: AnalysisOptions = {}): Promise<AnalysisResult> => {
  console.log('🚀 Iniciando análise completa do gráfico...');
  
  const numCandles = options.optimizeForScalping ? 60 : 120;
  const timeframe = options.timeframe || '1m';
  
  const candles = await generateMockCandles(numCandles, timeframe);
  
  console.log(`📊 Gerados ${candles.length} candles para análise`);
  
  // NOVO: Análise avançada de condições de mercado
  const advancedConditions = analyzeAdvancedMarketConditions(candles);
  const operatingScore = calculateOperatingScore(advancedConditions);
  const confidenceReduction = calculateConfidenceReduction(advancedConditions);
  
  console.log(`🎯 Score de operação: ${operatingScore}/100`);
  console.log(`⚠️ Redução de confiança: ${(confidenceReduction * 100).toFixed(0)}%`);
  console.log(`📋 Recomendação: ${advancedConditions.recommendation}`);
  
  if (advancedConditions.warnings.length > 0) {
    console.log('🚨 Warnings:', advancedConditions.warnings);
  }
  
  // Analyze volatility
  const volatilityAnalysis = analyzeVolatility(candles);
  console.log(`📈 Volatilidade: ${volatilityAnalysis.currentVolatility.toFixed(2)}% (ratio: ${volatilityAnalysis.volatilityRatio.toFixed(2)})`);
  
  // Generate patterns with reduced confidence based on market conditions
  const patternTypes = ['Martelo', 'Engolfo de Alta', 'Estrela Cadente', 'Doji', 'Triângulo'];
  const patterns: PatternResult[] = [];
  
  for (const patternType of patternTypes) {
    const detectedPatterns = await detectChartPatterns(candles, patternType, options);
    
    detectedPatterns.forEach(pattern => {
      patterns.push({
        type: pattern.pattern,
        confidence: pattern.confidence,
        description: pattern.description,
        recommendation: pattern.recommendation,
        action: pattern.action,
      });
    });
  }
  
  // MODIFICADO: Aplicar redução de confiança baseada nas condições de mercado
  patterns.forEach(pattern => {
    pattern.confidence *= confidenceReduction;
    
    // Adicionar warnings específicos se as condições são ruins
    if (operatingScore < 30) {
      pattern.description += ` ⚠️ CUIDADO: Condições adversas de mercado (Score: ${operatingScore}/100)`;
    }
  });
  
  // Price action analysis
  const priceActionSignals = analyzePriceAction(candles);
  console.log(`⚡️ Price Action Signals: ${priceActionSignals.length} signals detected`);
  
  // Volume analysis
  const volumeData: VolumeData = analyzeVolume(candles);
  console.log(`📊 Volume Analysis: Trend - ${volumeData.trend}, Significance - ${volumeData.significance}`);
  
  // Divergence analysis
  const divergences = detectDivergences(candles);
  console.log(`🔍 Divergências encontradas: ${divergences.length}`);
  
  // Candlestick patterns
  let candlePatterns: DetectedPattern[] = [];
  if (options.enableCandleDetection !== false) {
    candlePatterns = detectCandlestickPatterns(candles);
    console.log(`🕯️ Padrões de candlestick detectados: ${candlePatterns.length}`);
  }
  
  // Technical indicators
  const technicalIndicators: TechnicalIndicator[] = detectTechnicalIndicators(candles);
  console.log(`⚙️ Indicadores técnicos detectados: ${technicalIndicators.length}`);
  
  // Scalping signals
  const scalpingSignals: ScalpingSignal[] = candlePatterns.map(signal => ({
    type: 'entrada',
    action: signal.action === 'compra' ? 'compra' : 'venda',
    price: '...',
    confidence: signal.confidence,
    timeframe: options.timeframe || '1m',
    description: signal.description,
  }));
  console.log(`⚡️ Scalping Signals: ${scalpingSignals.length} signals detected`);
  
  // Market context
  const marketContextAnalysis = analyzeMarketContext(candles);
  console.log(`🌎 Market Context: Phase - ${marketContextAnalysis.phase}, Sentiment - ${marketContextAnalysis.sentiment}`);
  
  // Confluence analysis
  const confluenceAnalysis = performConfluenceAnalysis(candles, candlePatterns);
  console.log(`🤝 Confluence Score: ${confluenceAnalysis.confluenceScore}`);
  
  // NOVO: Criar contexto de mercado aprimorado
  const enhancedMarketContext: EnhancedMarketContext = {
    phase: marketContextAnalysis.phase || 'indefinida',
    strength: 'moderada',
    dominantTimeframe: options.timeframe || '1m',
    sentiment: marketContextAnalysis.sentiment || 'neutro',
    description: `Score: ${operatingScore}/100`,
    marketStructure: 'indefinida',
    breakoutPotential: 'baixo',
    momentumSignature: 'estável',
    advancedConditions,
    operatingScore,
    confidenceReduction
  };
  
  return {
    patterns,
    timestamp: Date.now(),
    imageUrl: imageData,
    technicalElements: [],
    candles: candles,
    scalpingSignals: scalpingSignals,
    technicalIndicators: technicalIndicators,
    volumeData: volumeData,
    volatilityData: volatilityAnalysis,
    marketContext: enhancedMarketContext,
    warnings: advancedConditions.warnings,
    preciseEntryAnalysis: {
      exactMinute: 'agora',
      entryType: 'reversão',
      nextCandleExpectation: 'confirmação',
      priceAction: 'bullish',
      confirmationSignal: 'aguardando',
      riskRewardRatio: 2.5,
      entryInstructions: 'Aguardar confirmação no próximo candle'
    }
  };
};
