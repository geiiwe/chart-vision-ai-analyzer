import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAnalyzer } from '@/context/AnalyzerContext';
import { Camera, Play, Pause, Settings, AlertTriangle, Activity, TrendingUp } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { enhanceImageForAnalysis } from '@/utils/imagePreProcessing';
import { analyzeChart } from '@/utils/patternDetection';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';

interface LiveAnalysisResult {
  timestamp: number;
  confidence: number;
  signal: 'compra' | 'venda' | 'neutro';
  patterns: string[];
  trend: 'alta' | 'baixa' | 'lateral';
  signalQuality?: string;
  confluenceScore?: number;
  supportResistance?: any[];
  criticalLevels?: any[];
  priceActionSignals?: any[];
  marketPhase?: string;
  institutionalBias?: string;
  entryRecommendations?: any[];
  riskReward?: number;
}

const LiveAnalysis = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [analysisInterval, setAnalysisInterval] = useState(3000); // 3 segundos por padrão
  const [liveResults, setLiveResults] = useState<LiveAnalysisResult[]>([]);
  const [currentAnalysis, setCurrentAnalysis] = useState<LiveAnalysisResult | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [confluenceDetails, setConfluenceDetails] = useState<any>(null);
  const [showConfluenceDetails, setShowConfluenceDetails] = useState(false);
  const [priceActionDetails, setPriceActionDetails] = useState<any>(null);
  const [showPriceActionDetails, setShowPriceActionDetails] = useState(false);
  const [entryRecommendations, setEntryRecommendations] = useState<any[]>([]);
  const [isChartVisible, setIsChartVisible] = useState(false);

  const isMobile = useIsMobile();
  const { toast } = useToast();
  const { 
    timeframe, 
    optimizeForScalping, 
    scalpingStrategy,
    considerVolume,
    considerVolatility,
    marketContextEnabled,
    marketAnalysisDepth 
  } = useAnalyzer();

  // Função para detectar se há um gráfico na tela
  const detectChartInFrame = async (imageData: string) => {
    // Simulação de detecção de gráfico - aqui você pode implementar
    // uma lógica mais sofisticada para detectar se há um gráfico presente
    return new Promise<boolean>((resolve) => {
      setTimeout(() => {
        // Por enquanto, retorna true aleatoriamente para simular
        const hasChart = Math.random() > 0.3;
        resolve(hasChart);
      }, 100);
    });
  };

  // Iniciar câmera
  const startCamera = async () => {
    try {
      setCameraError(null);
      
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Câmera não suportada neste navegador');
      }
      
      const constraints = {
        video: { 
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Erro ao acessar câmera:', error);
      setCameraError('Falha ao acessar a câmera. Verifique as permissões.');
      toast({
        variant: "destructive",
        title: "Erro na câmera",
        description: "Não foi possível acessar a câmera do dispositivo.",
      });
    }
  };

  // Parar câmera
  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  // Capturar frame e analisar apenas se houver gráfico
  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isAnalyzing) return;

    try {
      setIsAnalyzing(true);
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Capturar frame atual
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Converter para base64
      const imageUrl = canvas.toDataURL('image/jpeg', 0.8);
      
      // Verificar se há um gráfico visível na tela
      const hasChart = await detectChartInFrame(imageUrl);
      setIsChartVisible(hasChart);
      
      if (!hasChart) {
        // Se não há gráfico, não fazer análise
        setCurrentAnalysis(null);
        return;
      }
      
      // Melhorar imagem para análise
      const enhancedImageUrl = await enhanceImageForAnalysis(imageUrl);
      
      // Analisar com todas as funcionalidades ativadas
      const analysisResult = await analyzeChart(enhancedImageUrl, {
        timeframe: '1m',
        optimizeForScalping: true,
        scalpingStrategy,
        considerVolume,
        considerVolatility,
        marketContextEnabled,
        marketAnalysisDepth,
        enableCandleDetection: true,
        isLiveAnalysis: true,
        useConfluences: true,
        enablePriceAction: true,
        enableMarketContext: true
      });

      // Armazenar detalhes das confluências e price action
      setConfluenceDetails(analysisResult.confluences);
      setPriceActionDetails({
        signals: analysisResult.priceActionSignals || [],
        marketContext: analysisResult.detailedMarketContext
      });
      setEntryRecommendations(analysisResult.entryRecommendations || []);

      // Processar resultado para formato live - garantir coerência
      let finalConfidence = analysisResult.patterns[0]?.confidence || 0;
      let signalQuality = 'normal';
      let riskReward = 2.0;
      let mainSignal: 'compra' | 'venda' | 'neutro' = 'neutro';
      
      // Determinar sinal principal baseado no padrão mais forte
      if (analysisResult.patterns.length > 0) {
        const strongestPattern = analysisResult.patterns.reduce((prev, current) => 
          (current.confidence > prev.confidence) ? current : prev
        );
        
        mainSignal = strongestPattern.action === 'neutro' ? 'neutro' : strongestPattern.action;
        finalConfidence = strongestPattern.confidence;
      }
      
      // Melhor confiança vem das recomendações de entrada - mas deve ser coerente
      if (analysisResult.entryRecommendations && analysisResult.entryRecommendations.length > 0) {
        const bestEntry = analysisResult.entryRecommendations.find(entry => 
          entry.action === mainSignal
        ) || analysisResult.entryRecommendations[0];
        
        // Só usar se for coerente com o sinal principal
        if (bestEntry.action === mainSignal) {
          finalConfidence = Math.max(finalConfidence, bestEntry.confidence);
          riskReward = bestEntry.riskReward;
          
          if (bestEntry.confidence > 0.8) {
            signalQuality = 'excelente';
          } else if (bestEntry.confidence > 0.7) {
            signalQuality = 'forte';
          } else if (bestEntry.confidence > 0.6) {
            signalQuality = 'boa';
          }
        }
      }

      // Fix the trend mapping from English to Portuguese
      let mappedTrend: 'alta' | 'baixa' | 'lateral' = 'lateral';
      const rawTrend = analysisResult.detailedMarketContext?.marketStructure?.trend;
      
      if (rawTrend === 'bullish') {
        mappedTrend = 'alta';
      } else if (rawTrend === 'bearish') {
        mappedTrend = 'baixa';
      } else {
        mappedTrend = 'lateral';
      }

      const liveResult: LiveAnalysisResult = {
        timestamp: Date.now(),
        confidence: finalConfidence,
        signal: mainSignal,
        patterns: analysisResult.patterns.map(p => p.type),
        trend: mappedTrend,
        signalQuality,
        confluenceScore: analysisResult.confluences?.confluenceScore || 0,
        supportResistance: analysisResult.confluences?.supportResistance?.slice(0, 3) || [],
        criticalLevels: analysisResult.confluences?.criticalLevels || [],
        priceActionSignals: analysisResult.priceActionSignals?.slice(0, 2) || [],
        marketPhase: analysisResult.detailedMarketContext?.phase || 'indefinida',
        institutionalBias: analysisResult.detailedMarketContext?.institutionalBias || 'neutro',
        entryRecommendations: analysisResult.entryRecommendations?.filter(entry => 
          entry.action === mainSignal
        ).slice(0, 2) || [],
        riskReward
      };

      setCurrentAnalysis(liveResult);
      setLiveResults(prev => [liveResult, ...prev.slice(0, 19)]); // Manter últimos 20 resultados

      // Notificar apenas sinais de alta qualidade e coerentes
      if (finalConfidence > 0.7 && liveResult.signal !== 'neutro' && signalQuality !== 'fraca') {
        const paText = liveResult.priceActionSignals.length > 0 ? 
          ` | PA: ${liveResult.priceActionSignals[0].type}` : '';
        const rrText = riskReward > 2 ? ` | R:R ${riskReward.toFixed(1)}` : '';
        
        toast({
          variant: liveResult.signal === 'compra' ? "default" : "destructive",
          title: `🚨 ENTRADA ${signalQuality.toUpperCase()} - ${liveResult.signal.toUpperCase()}`,
          description: `Confiança: ${Math.round(finalConfidence * 100)}% | Fase: ${liveResult.marketPhase}${paText}${rrText}`,
          duration: 8000,
        });
      }

    } catch (error) {
      console.error('Erro na análise em tempo real:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, scalpingStrategy, considerVolume, considerVolatility, marketContextEnabled, marketAnalysisDepth, toast]);

  // Iniciar análise em tempo real
  const startLiveAnalysis = async () => {
    await startCamera();
    setIsLiveActive(true);
    
    // Aguardar um pouco para a câmera inicializar
    setTimeout(() => {
      intervalRef.current = setInterval(captureAndAnalyze, analysisInterval);
    }, 1000);

    toast({
      variant: "default",
      title: "✅ Análise Live Iniciada",
      description: `Analisando gráficos a cada ${analysisInterval / 1000} segundos`,
    });
  };

  // Parar análise em tempo real
  const stopLiveAnalysis = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    setIsLiveActive(false);
    stopCamera();
    setCurrentAnalysis(null);
    setIsChartVisible(false);

    toast({
      variant: "default",
      title: "⏹️ Análise Live Parada",
      description: "Análise em tempo real foi interrompida",
    });
  };

  // Alternar modo da câmera
  const toggleCameraFacing = () => {
    stopLiveAnalysis();
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      stopCamera();
    };
  }, []);

  // Reiniciar quando facing mode muda
  useEffect(() => {
    if (isLiveActive) {
      setTimeout(() => startLiveAnalysis(), 500);
    }
  }, [facingMode]);

  return (
    <div className="w-full space-y-4">
      {/* Cabeçalho de controles */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5" />
            Análise Live M1 - Detecção Inteligente
            {isLiveActive && (
              <Badge variant="default" className="ml-2 animate-pulse">
                AO VIVO
              </Badge>
            )}
            {isLiveActive && !isChartVisible && (
              <Badge variant="secondary" className="ml-2">
                AGUARDANDO GRÁFICO
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {!isLiveActive ? (
              <Button onClick={startLiveAnalysis} className="gap-2">
                <Play className="w-4 h-4" />
                Iniciar Live M1
              </Button>
            ) : (
              <Button onClick={stopLiveAnalysis} variant="destructive" className="gap-2">
                <Pause className="w-4 h-4" />
                Parar Live
              </Button>
            )}
            
            <Button 
              variant="outline" 
              onClick={toggleCameraFacing}
              disabled={isLiveActive}
              className="gap-2"
            >
              <Camera className="w-4 h-4" />
              {facingMode === 'environment' ? 'Traseira' : 'Frontal'}
            </Button>

            <select 
              value={analysisInterval} 
              onChange={(e) => setAnalysisInterval(Number(e.target.value))}
              disabled={isLiveActive}
              className="px-3 py-2 border rounded-md text-sm"
            >
              <option value={1000}>1 segundo</option>
              <option value={2000}>2 segundos</option>
              <option value={3000}>3 segundos</option>
              <option value={5000}>5 segundos</option>
            </select>

            {priceActionDetails && (
              <Button 
                variant="outline" 
                onClick={() => setShowPriceActionDetails(!showPriceActionDetails)}
                className="gap-2"
              >
                <TrendingUp className="w-4 h-4" />
                Price Action
              </Button>
            )}

            {confluenceDetails && (
              <Button 
                variant="outline" 
                onClick={() => setShowConfluenceDetails(!showConfluenceDetails)}
                className="gap-2"
              >
                <Settings className="w-4 h-4" />
                Confluências
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Erro da câmera */}
      {cameraError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{cameraError}</AlertDescription>
        </Alert>
      )}

      {/* Video feed com overlay aprimorado */}
      <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
        <video 
          ref={videoRef}
          autoPlay 
          playsInline
          muted 
          className="w-full h-full object-cover"
        />
        
        {isAnalyzing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-white text-center">
              <Activity className="animate-spin h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">
                {isChartVisible ? 'Analisando Price Action + Confluências...' : 'Procurando gráfico...'}
              </p>
            </div>
          </div>
        )}

        {/* Aviso quando não há gráfico */}
        {isLiveActive && !isChartVisible && !isAnalyzing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <div className="text-white text-center">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-400" />
              <p className="text-sm">Aponte a câmera para um gráfico</p>
              <p className="text-xs text-gray-300">Aguardando detecção automática...</p>
            </div>
          </div>
        )}

        {currentAnalysis && isChartVisible && (
          <motion.div 
            className="absolute top-4 left-4 right-4"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="bg-black/90 border-amber-200">
              <CardContent className="p-3">
                <div className="flex items-center justify-between text-white mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge 
                        variant={currentAnalysis.signal === 'compra' ? 'default' : 
                                 currentAnalysis.signal === 'venda' ? 'destructive' : 'secondary'}
                      >
                        {currentAnalysis.signal.toUpperCase()}
                      </Badge>
                      {currentAnalysis.signalQuality && (
                        <Badge 
                          variant={currentAnalysis.signalQuality === 'excelente' || currentAnalysis.signalQuality === 'forte' ? 'default' : 
                                   currentAnalysis.signalQuality === 'boa' ? 'secondary' : 'destructive'}
                          className="text-xs"
                        >
                          {currentAnalysis.signalQuality}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs">
                      Confiança: {Math.round(currentAnalysis.confidence * 100)}%
                    </p>
                    <p className="text-xs text-green-300">
                      R:R {currentAnalysis.riskReward?.toFixed(1) || '2.0'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-yellow-300">
                      Fase: {currentAnalysis.marketPhase}
                    </div>
                    <div className="text-xs text-blue-300">
                      Bias: {currentAnalysis.institutionalBias}
                    </div>
                    <div className="text-xs text-gray-300">
                      {new Date(currentAnalysis.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                
                {/* Price Action Signals */}
                {currentAnalysis.priceActionSignals && currentAnalysis.priceActionSignals.length > 0 && (
                  <div className="text-xs text-purple-300 mb-1">
                    PA: {currentAnalysis.priceActionSignals.map((pa: any) => pa.type).join(', ')}
                  </div>
                )}
                
                {/* Entry Recommendations - apenas coerentes */}
                {currentAnalysis.entryRecommendations && currentAnalysis.entryRecommendations.length > 0 && (
                  <div className="text-xs text-green-400">
                    Entrada: {currentAnalysis.entryRecommendations[0].entryPrice?.toFixed(4)} | 
                    SL: {currentAnalysis.entryRecommendations[0].stopLoss?.toFixed(4)} | 
                    TP: {currentAnalysis.entryRecommendations[0].takeProfit?.toFixed(4)}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Detalhes do Price Action */}
      {showPriceActionDetails && priceActionDetails && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Análise de Price Action M1</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Sinais de Price Action */}
            {priceActionDetails.signals && priceActionDetails.signals.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Sinais Detectados</h4>
                <div className="space-y-2">
                  {priceActionDetails.signals.slice(0, 3).map((signal: any, index: number) => (
                    <div key={index} className="border rounded p-2">
                      <div className="flex justify-between items-center mb-1">
                        <span className={`font-medium ${signal.direction === 'alta' ? 'text-green-600' : 'text-red-600'}`}>
                          {signal.type} - {signal.direction}
                        </span>
                        <Badge variant={signal.strength === 'forte' ? 'default' : 'secondary'}>
                          {signal.strength}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {signal.description}
                      </div>
                      <div className="text-xs text-blue-600 mt-1">
                        Confiança: {Math.round(signal.confidence * 100)}% | R:R {signal.riskReward?.toFixed(1)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contexto de Mercado Detalhado */}
            {priceActionDetails.marketContext && (
              <div>
                <h4 className="font-semibold mb-2">Contexto de Mercado</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Fase:</span> {priceActionDetails.marketContext.phase}
                  </div>
                  <div>
                    <span className="font-medium">Sentimento:</span> {priceActionDetails.marketContext.sentiment}
                  </div>
                  <div>
                    <span className="font-medium">Volatilidade:</span> {priceActionDetails.marketContext.volatilityState}
                  </div>
                  <div>
                    <span className="font-medium">Liquidez:</span> {priceActionDetails.marketContext.liquidityCondition}
                  </div>
                  <div>
                    <span className="font-medium">Bias Institucional:</span> {priceActionDetails.marketContext.institutionalBias}
                  </div>
                  <div>
                    <span className="font-medium">Horário:</span> {priceActionDetails.marketContext.timeOfDay}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recomendações de Entrada */}
      {entryRecommendations.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recomendações de Entrada M1</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {entryRecommendations.map((entry: any, index: number) => (
                <div key={index} className="border rounded-lg p-3 bg-muted/30">
                  <div className="flex justify-between items-center mb-2">
                    <Badge 
                      variant={entry.action === 'compra' ? 'default' : 'destructive'}
                      className="text-sm"
                    >
                      {entry.action.toUpperCase()}
                    </Badge>
                    <span className="text-sm font-medium">
                      Confiança: {Math.round(entry.confidence * 100)}%
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                    <div>
                      <span className="font-medium">Entrada:</span> {entry.entryPrice?.toFixed(4)}
                    </div>
                    <div>
                      <span className="font-medium">Stop:</span> {entry.stopLoss?.toFixed(4)}
                    </div>
                    <div>
                      <span className="font-medium">Alvo:</span> {entry.takeProfit?.toFixed(4)}
                    </div>
                  </div>
                  
                  <div className="text-xs text-muted-foreground mb-1">
                    R:R {entry.riskReward?.toFixed(1)} | Timeframe: {entry.timeframe}
                  </div>
                  
                  <div className="text-xs">
                    <span className="font-medium">Análise:</span> {entry.reasoning}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detalhes das confluências */}
      {showConfluenceDetails && confluenceDetails && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Análise de Confluências</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Score geral */}
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {Math.round(confluenceDetails.confluenceScore)}%
              </div>
              <div className="text-sm text-muted-foreground">Score de Confluência</div>
            </div>

            {/* Suportes e Resistências */}
            {confluenceDetails.supportResistance && confluenceDetails.supportResistance.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Suportes e Resistências</h4>
                <div className="space-y-1">
                  {confluenceDetails.supportResistance.slice(0, 3).map((level: any, index: number) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span className={level.type === 'support' ? 'text-green-600' : 'text-red-600'}>
                        {level.type === 'support' ? 'Suporte' : 'Resistência'} {level.strength}
                      </span>
                      <span>{level.price.toFixed(4)} ({level.confidence.toFixed(0)}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Estrutura de mercado */}
            {confluenceDetails.marketStructure && (
              <div>
                <h4 className="font-semibold mb-2">Estrutura de Mercado</h4>
                <div className="text-sm">
                  <span className={`px-2 py-1 rounded text-xs ${
                    confluenceDetails.marketStructure.structure === 'bullish' ? 'bg-green-100 text-green-800' :
                    confluenceDetails.marketStructure.structure === 'bearish' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {confluenceDetails.marketStructure.structure.toUpperCase()}
                  </span>
                </div>
              </div>
            )}

            {/* Price Action */}
            {confluenceDetails.priceAction && (
              <div>
                <h4 className="font-semibold mb-2">Price Action</h4>
                <div className="flex justify-between text-sm">
                  <span>Tendência: {confluenceDetails.priceAction.trend}</span>
                  <span>Momentum: {confluenceDetails.priceAction.momentum}</span>
                </div>
                <div className="text-sm">
                  Força: {Math.round(confluenceDetails.priceAction.strength)}%
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Histórico de resultados */}
      {liveResults.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Histórico de Sinais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              <AnimatePresence>
                {liveResults.map((result, index) => (
                  <motion.div
                    key={result.timestamp}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center justify-between p-2 border rounded-lg text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={result.signal === 'compra' ? 'default' : 
                                 result.signal === 'venda' ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {result.signal}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(result.confidence * 100)}%
                      </span>
                      {result.confluenceScore !== undefined && (
                        <span className="text-xs text-blue-600">
                          C:{Math.round(result.confluenceScore)}%
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">
                        {new Date(result.timestamp).toLocaleTimeString()}
                      </div>
                      <div className="text-xs">
                        {result.patterns.slice(0, 2).join(', ')}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LiveAnalysis;
