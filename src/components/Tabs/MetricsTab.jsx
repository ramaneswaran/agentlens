import React, { useEffect, useState, useMemo } from 'react';
import {
  loadCSVData,
  extractUniqueTools,
  prepareErrorByStepData,
  prepareDurationVsTokenData,
  prepareRuntimeDistributionData
} from '../../utils/dataProcessing';
import { Button, Form, Badge, Card, Row, Col } from 'react-bootstrap';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter,
  BarChart, Bar
} from 'recharts';

// Consistent color mapping for tools
const COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#00C49F',
  '#FF6B6B', '#FFBB28', '#A28EFF', '#FF9F9F', '#00B2CA',
  '#4B0082', '#006400', '#8B0000', '#FF1493', '#00BFFF'
];

const MetricsTab = () => {
  const [data, setData] = useState([]);
  const [availableTools, setAvailableTools] = useState([]);
  const [selectedTools, setSelectedTools] = useState([]);
  const [errorData, setErrorData] = useState([]);
  const [scatterData, setScatterData] = useState([]);
  const [runtimeData, setRuntimeData] = useState([]);
  const [tokenData, setTokenData] = useState([]);
  const [durationData, setDurationData] = useState([]);
  
  // Create a consistent color mapping for all tools
  const toolColorMap = useMemo(() => {
    const colorMap = {};
    availableTools.forEach((tool, index) => {
      colorMap[tool] = COLORS[index % COLORS.length];
    });
    return colorMap;
  }, [availableTools]);

  useEffect(() => {
    loadCSVData('/agent_metrics.csv').then(parsed => {
      const tools = extractUniqueTools(parsed);
      setData(parsed);
      setAvailableTools(tools);
      setSelectedTools(tools.slice(0, 5)); // ✅ select first 5 tools by default for better performance
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

      // Prepare runtime data
      const runtime = prepareRuntimeDistributionData(data).filter(d =>
        selectedTools.includes(d.tool)
      );
      setRuntimeData(runtime);

      // Simple token data - separate chart for tokens and duration
      const tokenMetrics = [];
      const durationMetrics = [];
      
      selectedTools.forEach(tool => {
        const toolData = data.filter(row => row.tool_name === tool);
        
        // Get average values with fallbacks to 0
        const promptTokens = toolData.reduce((sum, row) => sum + (row.prompt_tokens || 0), 0) / toolData.length || 0;
        const completionTokens = toolData.reduce((sum, row) => sum + (row.completion_tokens || 0), 0) / toolData.length || 0;
        const duration = toolData.reduce((sum, row) => sum + (row.duration || 0), 0) / toolData.length || 0;
        
        // Simpler approach - one object for tokens
        tokenMetrics.push({
          tool,
          prompt: Math.round(promptTokens),
          completion: Math.round(completionTokens),
          total: Math.round(promptTokens + completionTokens)
        });
        
        // Separate object for duration
        durationMetrics.push({
          tool,
          duration: parseFloat(duration.toFixed(2))
        });
      });
      
      setTokenData(tokenMetrics);
      setDurationData(durationMetrics);
    }
  }, [data, selectedTools]);

  const handleAddTool = (e) => {
    const tool = e.target.value;
    if (tool && !selectedTools.includes(tool)) {
      setSelectedTools([...selectedTools, tool]);
    }
  };

  const removeTool = (toolToRemove) => {
    setSelectedTools(selectedTools.filter(t => t !== toolToRemove));
  };

  return (
    <div className="p-4">
      <h5>Tool Selection</h5>
      <Form.Select onChange={handleAddTool} value="">
        <option value="">Select tool...</option>
        {availableTools.map(tool => (
          <option 
            key={tool} 
            value={tool}
            style={{ 
              backgroundColor: toolColorMap[tool] ? `${toolColorMap[tool]}22` : undefined,
              borderLeft: toolColorMap[tool] ? `4px solid ${toolColorMap[tool]}` : undefined
            }}
          >
            {tool}
          </option>
        ))}
      </Form.Select>

      <div className="mt-3 mb-4">
        {selectedTools.map((tool) => (
          <Badge
            key={tool}
            className="me-2 mb-2"
            style={{ 
              fontSize: '1rem', 
              padding: '0.5rem 0.75rem', 
              backgroundColor: toolColorMap[tool] || '#6c757d',
              color: '#fff',
              borderRadius: '16px'
            }}
          >
            {tool}
            <Button
              size="sm"
              variant="light"
              onClick={() => removeTool(tool)}
              className="ms-2 py-0 px-2"
              style={{ 
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                padding: '0',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: '8px'
              }}
            >
              ✕
            </Button>
          </Badge>
        ))}
      </div>

      {/* Chart 1: Error Count by Step */}
      {errorData.length > 0 && (
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
                    stroke={toolColorMap[tool] || COLORS[0]}
                    dot={{ r: 2 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Chart 2: Duration vs Token Count */}
      {scatterData.length > 0 && (
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
                    fill={toolColorMap[tool] || COLORS[0]}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Chart 3: Runtime Distribution */}
      {runtimeData.length > 0 && (
        <>
          <h6 className="mt-5">Runtime Distribution (Success vs Error)</h6>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart 
                data={runtimeData} 
                layout="vertical"
                margin={{ top: 20, right: 30, left: 50, bottom: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  type="number" 
                  label={{ value: 'Average Runtime (s)', position: 'insideBottomRight', offset: -10 }} 
                  padding={{ left: 0, right: 20 }}
                />
                <YAxis 
                  dataKey="tool" 
                  type="category" 
                  label={{ value: 'Tool', angle: -90, position: 'insideLeft', dx: -30 }} 
                  width={120}
                  tick={(props) => {
                    const { x, y, payload } = props;
                    const tool = payload.value;
                    return (
                      <g transform={`translate(${x},${y})`}>
                        <rect x={-48} y={-8} width={4} height={16} fill={toolColorMap[tool] || '#666'} />
                        <text x={-40} y={4} textAnchor="start" fill="#666" fontSize={11}>
                          {tool}
                        </text>
                      </g>
                    );
                  }}
                />
                <Tooltip />
                <Legend />
                <Bar dataKey="success.avg" fill="#00C49F" name="Success" />
                <Bar dataKey="error.avg" fill="#FF6B6B" name="Error" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* SIMPLIFIED APPROACH - Separate charts for tokens and duration */}
      <Row className="mt-5">
        <Col md={6}>
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
        </Col>
        
        <Col md={6}>
          <Card className="h-100">
            <Card.Header>
              <h6 className="mb-0">Average Duration by Tool</h6>
            </Card.Header>
            <Card.Body>
              {durationData.length > 0 && (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={durationData}
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
                      label={{ value: 'Duration (s)', angle: -90, position: 'insideLeft', dx: -20 }}
                    />
                    <Tooltip />
                    <Legend />
                    <Bar 
                      dataKey="duration" 
                      name="Average Duration (s)" 
                      fill={(data) => toolColorMap[data && data.tool] || "#00C49F"}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default MetricsTab;