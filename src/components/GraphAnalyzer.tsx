import React, { useState, useEffect } from 'react';
import CameraView from './CameraView';
import ChartRegionSelector from './ChartRegionSelector';
import ControlPanel from './ControlPanel';
import AnalysisResults from './AnalysisResults';
import MobileBottomBar from './MobileBottomBar';
import { useAnalyzer } from '@/context/AnalyzerContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ZoomIn, BarChart2, ChevronRight, Clock, Camera, Settings } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { checkImageQuality } from '@/utils/imagePreProcessing';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { getMasterAnalysis } from '@/utils/masterTechniques';
import { processChartImage } from '@/utils/imageProcessing';

const GraphAnalyzer = () => {
  const { 
    capturedImage, 
    analysisResults, 
    resetAnalysis, 
    selectedRegion, 
    timeframe,
    setTimeframe,
    setIsAnalyzing,
    isAnalyzing,
    setAnalysisResults
  } = useAnalyzer();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState("region");
  const { toast } = useToast();
  const [imageQuality, setImageQuality] = useState<{
    isGoodQuality: boolean;
    message: string;
    details?: {
      resolution: string;
      contrast: string;
      noise: string;
    }
  } | null>(null);

  // Check image quality when captured image changes
  React.useEffect(() => {
    if (capturedImage && !analysisResults) {
      checkImageQuality(capturedImage).then(result => {
        setImageQuality(result);
      });
    } else {
      setImageQuality(null);
    }
  }, [capturedImage, analysisResults]);

  // Ensure selected region is maintained during analysis
  useEffect(() => {
    if (analysisResults && !analysisResults.manualRegion && selectedRegion) {
      const updatedResults = { ...analysisResults, manualRegion: true };
      setAnalysisResults(updatedResults);
    }
  }, [analysisResults, selectedRegion, setAnalysisResults]);

  const handleTimeframeChange = (value: string) => {
    setTimeframe(value as '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w');
  };
  
  const startAnalysis = async () => {
    if (!capturedImage || !selectedRegion) {
      toast({
        title: "Selecione uma região",
        description: "Você precisa selecionar uma região do gráfico para análise",
        variant: "destructive",
      });
      return;
    }
    
    setIsAnalyzing(true);
    
    try {
      console.log('Starting analysis with timeframe:', timeframe);

      // Processar a imagem para obter dados de velas
      const candles = await processChartImage(capturedImage);
      console.log('Extracted candles:', candles);

      // Análise baseada nos mestres - Agora passando os candles
      // A assinatura de getMasterAnalysis precisará ser atualizada para aceitar 'candles'
      const masterAnalysis = getMasterAnalysis(timeframe, 'Pin Bar', candles); // Passar candles aqui
      
      console.log('Master analysis result:', masterAnalysis);
      
      const analysisResult: AnalysisResult = { // Usar AnalysisResult como tipo
        patterns: [
          {
            type: timeframe === '1m' ? 'Pin Bar' : 'Engolfo de Alta',
            confidence: masterAnalysis.bulkowski?.reliability || 0.78,
            description: `Padrão identificado seguindo metodologia de Bulkowski: ${masterAnalysis.bulkowski?.name || 'Padrão de reversão'}`,
            action: masterAnalysis.tripleScreen?.shortTermEntry === 'long' ? 'compra' : 
                   masterAnalysis.tripleScreen?.shortTermEntry === 'short' ? 'venda' : 'neutro' as 'compra' | 'venda' | 'neutro',
            isScalpingSignal: timeframe === '1m',
            recommendation: masterAnalysis.masterRecommendation
          }
        ],
        timestamp: Date.now(),
        imageUrl: capturedImage,
        manualRegion: true,
        preciseEntryAnalysis: {
          exactMinute: '12:45',
          entryType: 'reversão' as 'reversão' | 'retração' | 'pullback' | 'breakout' | 'teste_suporte' | 'teste_resistência',
          nextCandleExpectation: `Elder: ${masterAnalysis.tripleScreen?.shortTermEntry === 'long' ? 'Alta provável' : 'Baixa provável'} com fechamento ${masterAnalysis.tripleScreen?.shortTermEntry === 'long' ? 'acima' : 'abaixo'} da ${masterAnalysis.tripleScreen?.shortTermEntry === 'long' ? 'máxima' : 'mínima'} anterior`,
          priceAction: `Murphy: ${masterAnalysis.murphy?.volumeAnalysis?.trend === 'confirming' ? 'Volume confirmando' : 'Volume divergindo'} movimento`,
          confirmationSignal: `Bulkowski: ${masterAnalysis.bulkowski?.volumeImportance === 'critical' ? 'Volume crítico necessário' : 'Volume importante para confirmação'}`,
          riskRewardRatio: masterAnalysis.bulkowski?.averageMove ? Math.abs(masterAnalysis.bulkowski.averageMove) / 5 : 2.5,
          entryInstructions: `Edwards & Magee: Aguardar fechamento ${masterAnalysis.tripleScreen?.shortTermEntry === 'long' ? 'acima' : 'abaixo'} do nível com volume 50% acima da média`
        },
        marketContext: {
          phase: masterAnalysis.murphy?.trendAnalysis?.primary === 'bullish' ? 'tendência_alta' : 
                 masterAnalysis.murphy?.trendAnalysis?.primary === 'bearish' ? 'tendência_baixa' : 'lateral' as 'acumulação' | 'tendência_alta' | 'tendência_baixa' | 'distribuição' | 'lateral' | 'indefinida',
          strength: (masterAnalysis.tripleScreen?.confidence || 0) > 0.8 ? 'forte' : 
                   (masterAnalysis.tripleScreen?.confidence || 0) > 0.6 ? 'moderada' : 'fraca' as 'forte' | 'moderada' | 'fraca',
          description: `Análise integrada dos mestres: ${(masterAnalysis.masterRecommendation || '').split('\n\n')[0] || 'Análise em progresso'}`,
          dominantTimeframe: timeframe,
          sentiment: masterAnalysis.tripleScreen?.shortTermEntry === 'long' ? 'otimista' : 
                    masterAnalysis.tripleScreen?.shortTermEntry === 'short' ? 'pessimista' : 'neutro' as 'otimista' | 'pessimista' | 'neutro',
          marketStructure: masterAnalysis.murphy?.trendAnalysis?.primary === 'bullish' ? 'alta_altas' : 
                          masterAnalysis.murphy?.trendAnalysis?.primary === 'bearish' ? 'baixa_baixas' : 'indefinida' as 'alta_altas' | 'alta_baixas' | 'baixa_altas' | 'baixa_baixas' | 'indefinida',
          breakoutPotential: (masterAnalysis.bulkowski?.reliability || 0) > 0.7 ? 'alto' : 
                            (masterAnalysis.bulkowski?.reliability || 0) > 0.6 ? 'médio' : 'baixo' as 'alto' | 'médio' | 'baixo',
          momentumSignature: masterAnalysis.murphy?.volumeAnalysis?.trend === 'confirming' ? 'acelerando' : 'divergente' as 'acelerando' | 'estável' | 'desacelerando' | 'divergente',
          liquidityPools: masterAnalysis.murphy?.supportResistance?.map(sr => ({
            level: sr.level,
            strength: sr.strength === 'strong' ? 'alta' : sr.strength === 'moderate' ? 'média' : 'baixa' as 'alta' | 'média' | 'baixa'
          })) || []
        },
        volumeData: {
          value: 1250000,
          trend: masterAnalysis.murphy?.volumeAnalysis?.trend === 'confirming' ? 'increasing' : 'neutral' as 'increasing' | 'decreasing' | 'neutral',
          abnormal: masterAnalysis.bulkowski?.volumeImportance === 'critical',
          significance: masterAnalysis.murphy?.volumeAnalysis?.significance || 'high' as 'high' | 'medium' | 'low',
          relativeToAverage: 1.35,
          distribution: masterAnalysis.tripleScreen?.shortTermEntry === 'long' ? 'accumulation' : 'neutral' as 'accumulation' | 'distribution' | 'neutral',
          divergence: masterAnalysis.murphy?.volumeAnalysis?.trend === 'diverging'
        },
        volatilityData: {
          value: 2.3,
          trend: 'increasing' as 'increasing' | 'decreasing' | 'neutral',
          atr: 1.8,
          percentageRange: 1.2,
          isHigh: false,
          historicalComparison: 'above_average' as 'above_average' | 'below_average' | 'average'
        },
        masterAnalysis // Adicionando a análise dos mestres
      };
      
      console.log('Final simulated result:', analysisResult); // Renomear simulatedResult para analysisResult
      
      setAnalysisResults(analysisResult); // Usar analysisResult
      
      toast({
        title: "Análise dos Mestres Completa",
        description: "Análise baseada em Bulkowski, Elder, Murphy e Edwards & Magee",
      });
    } catch (error) {
      console.error("Erro ao processar análise:", error);
      toast({
        title: "Erro na análise",
        description: "Ocorreu um problema ao processar a análise. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const fadeAnimation = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
    transition: { duration: 0.3 }
  };

  // Renderização principal baseada no estado
  const renderMainContent = () => {
    // Se não há imagem capturada, mostrar a câmera
    if (!capturedImage) {
      return (
        <div className="w-full">
          <div className="text-center mb-4">
            <h2 className="text-xl font-bold mb-2">Capturar Imagem</h2>
            <p className="text-sm text-muted-foreground">
              Tire uma foto do gráfico para análise
            </p>
          </div>
          <CameraView />
        </div>
      );
    }

    // Se há resultados, mostrar apenas os resultados
    if (analysisResults) {
      return (
        <motion.div 
          className="space-y-3 w-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          key="analysis-results"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={resetAnalysis}
                className="mr-1"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-bold">Resultados</h2>
            </div>
          </div>
          <div className="w-full overflow-hidden">
            <AnalysisResults />
          </div>
        </motion.div>
      );
    }

    // Se está analisando, mostrar loading
    if (isAnalyzing) {
      return (
        <motion.div 
          className="space-y-3 w-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          key="analyzing"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={resetAnalysis}
                className="mr-1"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-bold">Analisando...</h2>
            </div>
          </div>
          
          <div className="flex flex-col items-center justify-center p-6 bg-card/50 rounded-lg border border-border/30">
            <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin mb-4"></div>
            <p className="text-base font-medium">Analisando região selecionada...</p>
            <p className="text-xs text-muted-foreground mt-2">
              Processando padrões e indicadores técnicos
            </p>
          </div>
        </motion.div>
      );
    }

    // Estado padrão: configuração da análise
    return (
      <motion.div 
        className="space-y-3 w-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        key="configuration"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={resetAnalysis}
              className="mr-1"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-bold">Configurar</h2>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-secondary/60 rounded-md px-2 py-1">
              <Clock className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
              <Select value={timeframe} onValueChange={handleTimeframeChange}>
                <SelectTrigger className="h-6 w-12 text-xs border-0 p-0 pl-1 bg-transparent">
                  <SelectValue placeholder="1m" />
                </SelectTrigger>
                <SelectContent side="bottom">
                  <SelectItem value="1m">1m</SelectItem>
                  <SelectItem value="5m">5m</SelectItem>
                  <SelectItem value="15m">15m</SelectItem>
                  <SelectItem value="30m">30m</SelectItem>
                  <SelectItem value="1h">1h</SelectItem>
                  <SelectItem value="4h">4h</SelectItem>
                  <SelectItem value="1d">1d</SelectItem>
                  <SelectItem value="1w">1w</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center gap-1"
              onClick={() => {
                if (activeTab === "region") {
                  setActiveTab("controls");
                } else {
                  startAnalysis();
                }
              }}
            >
              {activeTab === "region" ? "Próximo" : "Analisar"}
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
        
        {imageQuality && (
          <Alert variant={imageQuality.isGoodQuality ? "default" : "destructive"} className="mb-2 rounded-lg">
            <BarChart2 className="h-4 w-4" />
            <AlertTitle className="text-sm">Qualidade da Imagem</AlertTitle>
            <AlertDescription className="text-xs">
              {imageQuality.message}
              {imageQuality.details && (
                <ul className="mt-1 list-disc list-inside text-xs">
                  <li>Resolução: {imageQuality.details.resolution}</li>
                  <li>Contraste: {imageQuality.details.contrast}</li>
                  <li>Ruído: {imageQuality.details.noise}</li>
                </ul>
              )}
            </AlertDescription>
          </Alert>
        )}
        
        <Card className="p-0 overflow-hidden bg-card/50 rounded-lg shadow-sm">
          <CardContent className="p-2">
            <div className="relative w-full overflow-hidden rounded-md">
              <img 
                src={capturedImage} 
                alt="Captured Chart" 
                className="w-full object-contain" 
              />
              <Button variant="secondary" size="icon" className="absolute top-1 right-1 h-7 w-7 opacity-80">
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
        
        <Tabs defaultValue="region" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-10">
            <TabsTrigger value="region" className="text-xs">Região do Gráfico</TabsTrigger>
            <TabsTrigger value="controls" className="text-xs">Análise Avançada</TabsTrigger>
          </TabsList>
          <TabsContent value="region" className="mt-2">
            <ChartRegionSelector />
          </TabsContent>
          <TabsContent value="controls" className="mt-2">
            <ControlPanel />
          </TabsContent>
        </Tabs>
      </motion.div>
    );
  };

  return (
    <div className={`w-full ${isMobile ? 'px-1' : 'max-w-4xl'} mx-auto overflow-hidden`}>
      {renderMainContent()}
      <MobileBottomBar />
    </div>
  );
};

export default GraphAnalyzer;
