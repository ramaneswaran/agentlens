import React, { useEffect, useState, useMemo } from 'react';
import {
  loadCSVData,
  extractUniqueTools,
  prepareErrorByStepData,
  prepareDurationVsTokenData
} from '../../utils/dataProcessing';
import {
  prepareBoxplotDataForPlotly,
  prepareHeatmapDataForPlotly
} from '../../utils/plotlyHelpers';
import { Button, Form, Card, Row, Col } from 'react-bootstrap';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, BarChart, Bar, 
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import Plot from 'react-plotly.js';

const EXTENDED_COLORS = [
  "#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231",
  "#911eb4", "#46f0f0", "#f032e6", "#bcf60c", "#fabebe",
  "#008080", "#e6beff", "#9a6324", "#fffac8", "#800000",
  "#aaffc3", "#808000", "#ffd8b1", "#000075", "#808080"
];

// Custom Badge component to ensure styling is applied consistently
const ColoredBadge = ({ color, children, onRemove }) => (
  <span 
    className="badge rounded-pill" 
    style={{ 
      backgroundColor: color, 
      color: "#fff",
      fontSize: '1rem', 
      padding: '0.5rem 0.75rem', 
      margin: '0.25rem',
      display: 'inline-block',
      fontWeight: '500'
    }}
  >
    {children}
    {onRemove && (
      <button
        onClick={onRemove}
        style={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.3)',
          border: 'none',
          borderRadius: '50%',
          width: '20px',
          height: '20px',
          padding: '0',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: '8px',
          cursor: 'pointer',
          fontSize: '0.875rem',
          fontWeight: 'bold',
          color: 'white'
        }}
      >
        ✕
      </button>
    )}
  </span>
);

const MetricsTab = () => {
  const [data, setData] = useState([]);
  const [availableTools, setAvailableTools] = useState([]);
  const [selectedTools, setSelectedTools] = useState([]);
  const [errorData, setErrorData] = useState([]);
  const [scatterData, setScatterData] = useState([]);
  const [boxplotData, setBoxplotData] = useState({ data: [], layout: {} });
  const [heatmapData, setHeatmapData] = useState({ data: [], layout: {} });
  const [radarData, setRadarData] = useState([]);
  const [tokenData, setTokenData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Create a consistent color mapping for all tools
  const toolColorMap = useMemo(() => {
    const colorMap = {};
    availableTools.forEach((tool, index) => {
      colorMap[tool] = EXTENDED_COLORS[index % EXTENDED_COLORS.length];
    });
    return colorMap;
  }, [availableTools]);

  // Prepare radar chart data
  const prepareRadarData = (data) => {
    return selectedTools.map(tool => {
      const toolData = data.filter(row => row.tool_name === tool);
      
      if (toolData.length === 0) {
        return {
          subject: tool,
          'Avg Duration (s)': 0,
          'Avg Token Count': 0,
          'Error Rate (%)': 0
        };
      }
      
      const avgDuration = toolData.reduce((sum, row) => sum + (row.duration || 0), 0) / toolData.length;
      const avgTokens = toolData.reduce((sum, row) => sum + (row.token_count || 0), 0) / toolData.length;
      const errorRate = toolData.filter(row => row.has_error).length / toolData.length;
      
      return {
        subject: tool,
        'Avg Duration (s)': parseFloat(avgDuration.toFixed(2)),
        'Avg Token Count': Math.round(avgTokens),
        'Error Rate (%)': parseFloat((errorRate * 100).toFixed(1))
      };
    });
  };

  useEffect(() => {
    setIsLoading(true);
    loadCSVData('/agent_metrics.csv').then(parsed => {
      const tools = extractUniqueTools(parsed);
      setData(parsed);
      setAvailableTools(tools);
      setSelectedTools(tools.slice(0, 5)); // Select first 5 tools by default
      setIsLoading(false);
    })
    .catch(error => {
      console.error("Error loading data:", error);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    if (data.length && selectedTools.length) {
      // Prepare error data
      const errData = prepareErrorByStepData(data).map(row => {
        const filtered = { step: row.step };
        selectedTools.forEach(tool => {
          filtered[tool] = row[tool] || 0;
        });
        return filtered;
      });
      setErrorData(errData);

      // Prepare scatter data
      const scatter = prepareDurationVsTokenData(data).filter(d =>
        selectedTools.includes(d.tool)
      );
      setScatterData(scatter);

      // Prepare boxplot data with Plotly format
      const boxplot = prepareBoxplotDataForPlotly(data, selectedTools);
      setBoxplotData(boxplot);

      // Prepare heatmap data with Plotly format
      const heatmap = prepareHeatmapDataForPlotly(data, selectedTools);
      setHeatmapData(heatmap);

      // Prepare radar chart data
      const radar = prepareRadarData(data);
      setRadarData(radar);

      // Simple token data
      const tokenMetrics = [];
      
      selectedTools.forEach(tool => {
        const toolData = data.filter(row => row.tool_name === tool);
        
        // Get average values with fallbacks to 0
        const promptTokens = toolData.reduce((sum, row) => sum + (row.prompt_tokens || 0), 0) / toolData.length || 0;
        const completionTokens = toolData.reduce((sum, row) => sum + (row.completion_tokens || 0), 0) / toolData.length || 0;
        
        tokenMetrics.push({
          tool,
          prompt: Math.round(promptTokens),
          completion: Math.round(completionTokens),
          total: Math.round(promptTokens + completionTokens)
        });
      });
      
      setTokenData(tokenMetrics);
    }
  }, [data, selectedTools]);

  const handleAddTool = (e) => {
    const tool = e.target.value;
    if (tool && !selectedTools.includes(tool)) {
      setSelectedTools([...selectedTools, tool]);
      e.target.value = ""; // Reset the dropdown after selection
    }
  };

  const removeTool = (toolToRemove) => {
    setSelectedTools(selectedTools.filter(t => t !== toolToRemove));
  };

  if (isLoading) {
    return <div className="p-4">Loading metrics data...</div>;
  }

  return (
    <div className="p-4">
      <h5>Tool Selection</h5>
      
      <Form.Select 
        onChange={handleAddTool} 
        value=""
        className="mb-3"
      >
        <option value="">Select tool to add...</option>
        {availableTools
          .filter(tool => !selectedTools.includes(tool))
          .map(tool => (
            <option 
              key={tool} 
              value={tool}
              style={{ 
                backgroundColor: toolColorMap[tool] ? `${toolColorMap[tool]}22` : undefined,
                borderLeft: toolColorMap[tool] ? `4px solid ${toolColorMap[tool]}` : undefined,
                padding: '8px',
                fontWeight: '500'
              }}
            >
              {tool}
            </option>
          ))
        }
      </Form.Select>

      <div className="mb-4">
        <h6 className="text-muted mb-2">Selected Tools:</h6>
        {selectedTools.length === 0 ? (
          <p className="fst-italic text-muted">No tools selected. Please select tools from the dropdown above.</p>
        ) : (
          selectedTools.map((tool) => (
            <ColoredBadge 
              key={tool}
              color={toolColorMap[tool] || '#6c757d'}
              onRemove={() => removeTool(tool)}
            >
              {tool}
            </ColoredBadge>
          ))
        )}
      </div>

      {/* Chart 1: Error Count by Step */}
      {errorData.length > 0 && selectedTools.length > 0 && (
        <>
          <h6>Error Count by Step</h6>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart 
                data={errorData}
                margin={{ top: 20, right: 30, left: 50, bottom: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="step" 
                  label={{ value: 'Step Number', position: 'insideBottomRight', offset: -10 }} 
                  padding={{ left: 20, right: 20 }}
                />
                <YAxis 
                  label={{ value: 'Error Count', angle: -90, position: 'insideLeft', dx: -20 }}
                  padding={{ top: 20, bottom: 20 }}
                />
                <Tooltip />
                <Legend />
                {selectedTools.map((tool) => (
                  <Line
                    key={tool}
                    type="monotone"
                    dataKey={tool}
                    stroke={toolColorMap[tool] || EXTENDED_COLORS[0]}
                    dot={{ r: 2 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Chart 2: Duration vs Token Count */}
      {scatterData.length > 0 && selectedTools.length > 0 && (
        <>
          <h6 className="mt-5">Duration vs Token Count</h6>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <ScatterChart
                margin={{ top: 20, right: 30, left: 50, bottom: 30 }}
              >
                <CartesianGrid />
                <XAxis 
                  type="number" 
                  dataKey="tokenCount" 
                  name="Token Count" 
                  label={{ value: 'Token Count', position: 'insideBottomRight', offset: -10 }} 
                  padding={{ left: 20, right: 20 }}
                />
                <YAxis 
                  type="number" 
                  dataKey="duration" 
                  name="Duration (s)" 
                  label={{ value: 'Duration (s)', angle: -90, position: 'insideLeft', dx: -20 }} 
                  padding={{ top: 20, bottom: 20 }}
                />
                <Tooltip />
                <Legend />
                {selectedTools.map((tool) => (
                  <Scatter
                    key={tool}
                    name={tool}
                    data={scatterData.filter(d => d.tool === tool)}
                    fill={toolColorMap[tool] || EXTENDED_COLORS[0]}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* NEW CHART: Proper Boxplot with Plotly */}
      {boxplotData.data.length > 0 && selectedTools.length > 0 && (
        <>
          <h6 className="mt-5">Runtime Distribution Boxplots</h6>
          <div className="border rounded p-2 bg-light">
            <Plot
              data={boxplotData.data}
              layout={boxplotData.layout}
              config={{ responsive: true }}
              style={{ width: '100%', height: 450 }}
            />
          </div>
        </>
      )}

      {/* NEW CHART: Proper Heatmap with Plotly */}
      {heatmapData.data.length > 0 && selectedTools.length > 0 && (
        <>
          <h6 className="mt-5">Duration Heatmap (Tool × Step)</h6>
          <div className="border rounded p-2 bg-light">
            <Plot
              data={heatmapData.data}
              layout={heatmapData.layout}
              config={{ responsive: true }}
              style={{ width: '100%', height: 450 }}
            />
          </div>
        </>
      )}

      {/* Token Distribution */}
      {selectedTools.length > 0 && (
        <div className="mt-5">
          <Card className="h-100">
            <Card.Header>
              <h6 className="mb-0">Token Distribution by Tool</h6>
            </Card.Header>
            <Card.Body>
              {tokenData.length > 0 && (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={tokenData}
                    margin={{ top: 20, right: 30, left: 50, bottom: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="tool" 
                      label={{ value: 'Tool', position: 'insideBottom', offset: 0, dy: 20 }}
                      tick={(props) => {
                        const { x, y, payload } = props;
                        const tool = payload.value;
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <text x={0} y={10} textAnchor="middle" fill="#666" fontSize={10}>
                              {tool}
                            </text>
                            <rect x={-10} y={15} width={20} height={4} fill={toolColorMap[tool] || '#666'} />
                          </g>
                        );
                      }}
                      height={60}
                    />
                    <YAxis 
                      label={{ value: 'Token Count', angle: -90, position: 'insideLeft', dx: -20 }}
                    />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="prompt" name="Prompt Tokens" stackId="a" fill="#FF4444" />
                    <Bar dataKey="completion" name="Completion Tokens" stackId="a" fill="#FFA500" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card.Body>
          </Card>
        </div>
      )}
      
      {selectedTools.length === 0 && (
        <div className="mt-5 p-4 text-center bg-light rounded">
          <h5>No Tools Selected</h5>
          <p>Please select tools from the dropdown above to view metrics.</p>
        </div>
      )}
    </div>
  );
};

export default MetricsTab;