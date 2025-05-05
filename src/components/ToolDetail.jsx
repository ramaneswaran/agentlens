import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, Tooltip as PieTooltip, ResponsiveContainer as PieContainer,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, LineChart, Line, AreaChart, Area
} from 'recharts';
import {
  loadCSVData,
  extractUniqueTools,
  prepareToolMetrics,
  prepareDurationVsTokenData
} from '../utils/dataProcessing';
import { Button, Card, Badge, Row, Col, Tabs, Tab } from 'react-bootstrap';
import Plot from 'react-plotly.js';

// Custom Badge component to ensure styling is applied consistently
const MetricBadge = ({ label, value, unit, color }) => (
  <Badge 
    pill 
    bg="light" 
    text="dark"
    className="me-2 mb-2" 
    style={{ 
      border: `1px solid ${color || '#dee2e6'}`,
      fontSize: '0.85rem',
      padding: '0.5em 0.85em'
    }}
  >
    {label}: <span style={{ color, fontWeight: 'bold' }}>{value}{unit || ''}</span>
  </Badge>
);

// Get tool color from index in tool list (for consistency across app)
const getToolColor = (toolName, allTools) => {
  const TOOL_COLORS = [
    "#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231",
    "#911eb4", "#46f0f0", "#f032e6", "#bcf60c", "#fabebe",
    "#008080", "#e6beff", "#9a6324", "#fffac8", "#800000",
    "#aaffc3", "#808000", "#ffd8b1", "#000075", "#808080"
  ];
  
  if (!allTools || !toolName) return TOOL_COLORS[0];
  
  const index = allTools.indexOf(toolName);
  return index >= 0 ? TOOL_COLORS[index % TOOL_COLORS.length] : TOOL_COLORS[0];
};

const ToolDetail = () => {
  const { toolName } = useParams();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState(null);
  const [scatterData, setScatterData] = useState([]);
  const [barData, setBarData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [allTools, setAllTools] = useState([]);
  const [toolColor, setToolColor] = useState("#4363d8");
  const [timelineData, setTimelineData] = useState([]);
  const [boxplotData, setBoxplotData] = useState({ data: [], layout: {} });
  const [loading, setLoading] = useState(true);

  // Helper function to prepare timeline data
  const prepareTimelineData = (data, toolName) => {
    // Filter for the specific tool
    const toolData = data.filter(d => d.tool_name === toolName);
    
    // Sort by timestamp (if available) or use indices
    return toolData.map((item, index) => ({
      id: index + 1,
      duration: item.duration || 0,
      tokens: item.token_count || 0,
      promptTokens: item.prompt_tokens || 0,
      completionTokens: item.completion_tokens || 0,
      hasError: !!item.has_error,
      timestamp: item.timestamp || `Run ${index + 1}`,
      step: item.step || 0
    }));
  };

  // Helper function to prepare boxplot data
  const prepareBoxplotData = (data, toolName) => {
    // Filter for the specific tool
    const toolData = data.filter(d => d.tool_name === toolName);
    
    // Get success and error durations
    const successDurations = toolData
      .filter(d => !d.has_error)
      .map(d => d.duration);
    
    const errorDurations = toolData
      .filter(d => d.has_error)
      .map(d => d.duration);
    
    // Get token counts for additional analysis
    const tokenCounts = toolData.map(d => d.token_count);
    
    // Prepare traces for Plotly
    const traces = [];
    
    // Add success trace if we have data
    if (successDurations.length > 0) {
      traces.push({
        type: 'box',
        y: successDurations,
        name: 'Success',
        boxpoints: 'outliers',
        jitter: 0.3,
        pointpos: -1.5,
        boxmean: true,
        marker: {
          color: 'rgba(44, 160, 101, 0.7)'
        },
        line: {
          color: 'rgba(44, 160, 101, 1)'
        }
      });
    }
    
    // Add error trace if we have data
    if (errorDurations.length > 0) {
      traces.push({
        type: 'box',
        y: errorDurations,
        name: 'Error',
        boxpoints: 'outliers',
        jitter: 0.3,
        pointpos: -1.5,
        boxmean: true,
        marker: {
          color: 'rgba(255, 65, 54, 0.7)'
        },
        line: {
          color: 'rgba(255, 65, 54, 1)'
        }
      });
    }
    
    // Prepare layout for the plot
    const layout = {
      title: 'Runtime Distribution',
      yaxis: {
        title: 'Duration (s)',
        zeroline: true
      },
      boxmode: 'group',
      showlegend: true,
      margin: { 
        l: 60,
        r: 30,
        t: 50,
        b: 30 
      }
    };
    
    return { 
      data: traces,
      layout
    };
  };

  useEffect(() => {
    setLoading(true);
    loadCSVData('/agent_metrics.csv').then(data => {
      // Get all tools for consistent color mapping
      const tools = extractUniqueTools(data);
      setAllTools(tools);
      setToolColor(getToolColor(toolName, tools));
      
      // Prepare main metrics
      const detail = prepareToolMetrics(data, toolName);
      setMetrics(detail);

      // Prepare scatter plot data
      const allScatterData = prepareDurationVsTokenData(data);
      const filteredScatterData = allScatterData.filter(d => d.tool === toolName);
      setScatterData(filteredScatterData);

      // Prepare step performance data
      const steps = detail.stepMetrics || {};
      const barChartData = Object.entries(steps).map(([step, stat]) => ({
        step: `Step ${step}`,
        timePerToken: stat.avgTimePerToken || 0,
        avgDuration: stat.avgDuration || 0,
        errorRate: (stat.errorRate || 0) * 100
      }));
      setBarData(barChartData);
      
      // Prepare timeline data
      const timeline = prepareTimelineData(data, toolName);
      setTimelineData(timeline);
      
      // Prepare historical performance data
      const history = timeline.map((item, index) => ({
        run: index + 1,
        duration: item.duration,
        tokens: item.tokens,
        hasError: item.hasError ? 1 : 0
      }));
      setHistoryData(history);
      
      // Prepare boxplot data
      const boxplot = prepareBoxplotData(data, toolName);
      setBoxplotData(boxplot);
      
      setLoading(false);
    });
  }, [toolName]);

  if (loading) return <div className="p-4">Loading tool details...</div>;
  if (!metrics) return <p className="p-4">No data available for this tool.</p>;

  const pieData = [
    { name: 'Prompt Tokens', value: metrics.tokenDistribution.prompt || 0 },
    { name: 'Completion Tokens', value: metrics.tokenDistribution.completion || 0 },
  ];

  return (
    <div className="p-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex align-items-center">
          <Button variant="secondary" size="sm" onClick={() => navigate(-1)} className="me-3">← Back</Button>
          <h4 className="mb-0">
            <span 
              className="badge" 
              style={{ 
                backgroundColor: toolColor, 
                marginRight: '10px', 
                width: '10px', 
                height: '10px', 
                display: 'inline-block',
                borderRadius: '50%'
              }}
            ></span>
            {toolName}
          </h4>
        </div>
        <div>
          {/* Add any action buttons here if needed */}
        </div>
      </div>

      {/* Key Metrics Row */}
      <Row className="mb-4">
        <Col md={12}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <h6 className="text-muted mb-3">Key Metrics</h6>
              <div className="d-flex flex-wrap">
                <MetricBadge 
                  label="Avg Duration" 
                  value={metrics.avgDuration.toFixed(2)} 
                  unit="s" 
                  color={toolColor}
                />
                <MetricBadge 
                  label="Error Rate" 
                  value={(metrics.overallErrorRate * 100).toFixed(1)} 
                  unit="%" 
                  color={metrics.overallErrorRate > 0.2 ? '#dc3545' : toolColor}
                />
                <MetricBadge 
                  label="Avg Total Tokens" 
                  value={Math.round(metrics.avgTokens || 0)} 
                  color={toolColor}
                />
                <MetricBadge 
                  label="Prompt Tokens" 
                  value={Math.round(metrics.tokenDistribution.prompt || 0)} 
                  color={toolColor}
                />
                <MetricBadge 
                  label="Completion Tokens" 
                  value={Math.round(metrics.tokenDistribution.completion || 0)} 
                  color={toolColor}
                />
                {metrics.tokenDistribution.cached_tokens_pct !== undefined && (
                  <MetricBadge 
                    label="Cached Tokens" 
                    value={(metrics.tokenDistribution.cached_tokens_pct * 100).toFixed(1)} 
                    unit="%" 
                    color={toolColor}
                  />
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Tabs defaultActiveKey="overview" className="mb-4">
        <Tab eventKey="overview" title="Overview">
          <Row className="gy-4">
            {/* Token Distribution */}
            <Col md={6}>
              <Card className="h-100 shadow-sm">
                <Card.Header style={{ backgroundColor: `${toolColor}15` }}>
                  <h6 className="mb-0">Token Distribution</h6>
                </Card.Header>
                <Card.Body>
                  <div style={{ height: 250 }}>
                    <PieContainer>
                      <PieChart>
                        <Pie 
                          data={pieData} 
                          dataKey="value" 
                          nameKey="name" 
                          cx="50%" 
                          cy="50%" 
                          outerRadius={80} 
                          label
                        >
                          {pieData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={index === 0 ? `${toolColor}dd` : `${toolColor}77`} 
                            />
                          ))}
                        </Pie>
                        <PieTooltip formatter={(value) => [`${value} tokens`, '']} />
                        <Legend />
                      </PieChart>
                    </PieContainer>
                  </div>
                </Card.Body>
              </Card>
            </Col>

            {/* Runtime Distribution */}
            <Col md={6}>
              <Card className="h-100 shadow-sm">
                <Card.Header style={{ backgroundColor: `${toolColor}15` }}>
                  <h6 className="mb-0">Runtime Distribution</h6>
                </Card.Header>
                <Card.Body>
                  <div style={{ height: 250 }}>
                    <Plot
                      data={boxplotData.data}
                      layout={boxplotData.layout}
                      config={{ responsive: true, displayModeBar: false }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  </div>
                </Card.Body>
              </Card>
            </Col>

            {/* Token Count vs Duration */}
            <Col md={12}>
              <Card className="shadow-sm">
                <Card.Header style={{ backgroundColor: `${toolColor}15` }}>
                  <h6 className="mb-0">Token Count vs Duration</h6>
                </Card.Header>
                <Card.Body>
                  <div style={{ height: 300 }}>
                    <ResponsiveContainer>
                      <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          type="number" 
                          dataKey="tokenCount" 
                          name="Token Count" 
                          label={{ value: 'Token Count', position: 'insideBottomRight', offset: -10 }}
                        />
                        <YAxis 
                          type="number" 
                          dataKey="duration" 
                          name="Duration (s)" 
                          label={{ value: 'Duration (s)', angle: -90, position: 'insideLeft' }}
                        />
                        <Tooltip 
                          formatter={(value, name) => [
                            `${value.toFixed(2)} ${name === 'tokenCount' ? 'tokens' : 's'}`, 
                            name === 'tokenCount' ? 'Tokens' : 'Duration'
                          ]}
                          labelFormatter={() => toolName}
                        />
                        <Legend />
                        <Scatter
                          name="Success"
                          data={scatterData.filter(d => !d.hasError)}
                          fill="#00C49F"
                        />
                        <Scatter
                          name="Error"
                          data={scatterData.filter(d => d.hasError)}
                          fill="#FF6B6B"
                        />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </Card.Body>
              </Card>
            </Col>

            {/* Historical Performance */}
            <Col md={12}>
              <Card className="shadow-sm">
                <Card.Header style={{ backgroundColor: `${toolColor}15` }}>
                  <h6 className="mb-0">Historical Performance</h6>
                </Card.Header>
                <Card.Body>
                  <div style={{ height: 300 }}>
                    <ResponsiveContainer>
                      <LineChart data={historyData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="run" 
                          label={{ value: 'Run Number', position: 'insideBottomRight', offset: -10 }}
                        />
                        <YAxis 
                          yAxisId="left"
                          label={{ value: 'Duration (s)', angle: -90, position: 'insideLeft' }}
                        />
                        <YAxis 
                          yAxisId="right" 
                          orientation="right" 
                          label={{ value: 'Tokens', angle: 90, position: 'insideRight' }}
                        />
                        <Tooltip />
                        <Legend />
                        <Line 
                          yAxisId="left"
                          type="monotone" 
                          dataKey="duration" 
                          name="Duration (s)" 
                          stroke={toolColor} 
                          dot={{ stroke: toolColor, strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                        <Line 
                          yAxisId="right"
                          type="monotone" 
                          dataKey="tokens" 
                          name="Tokens" 
                          stroke="#FF8042" 
                          dot={{ stroke: "#FF8042", strokeWidth: 2, r: 4 }}
                        />
                        <Line 
                          yAxisId="left"
                          type="monotone" 
                          dataKey="hasError" 
                          name="Error" 
                          stroke="#FF0000" 
                          dot={{ stroke: "#FF0000", strokeWidth: 2, r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Tab>

        <Tab eventKey="step" title="Step Analysis">
          <Row className="gy-4">
            {/* Time per Token by Step */}
            <Col md={6}>
              <Card className="shadow-sm">
                <Card.Header style={{ backgroundColor: `${toolColor}15` }}>
                  <h6 className="mb-0">Time per Token by Step</h6>
                </Card.Header>
                <Card.Body>
                  <div style={{ height: 300 }}>
                    <ResponsiveContainer>
                      <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="step" />
                        <YAxis label={{ value: 'Time per Token (ms)', angle: -90, position: 'insideLeft' }} />
                        <Tooltip formatter={(val) => `${val.toFixed(5)} ms`} />
                        <Legend />
                        <Bar 
                          dataKey="timePerToken" 
                          name="Time per Token (ms)" 
                          fill={toolColor} 
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card.Body>
              </Card>
            </Col>

            {/* Error Rate by Step */}
            <Col md={6}>
              <Card className="shadow-sm">
                <Card.Header style={{ backgroundColor: `${toolColor}15` }}>
                  <h6 className="mb-0">Error Rate by Step</h6>
                </Card.Header>
                <Card.Body>
                  <div style={{ height: 300 }}>
                    <ResponsiveContainer>
                      <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="step" />
                        <YAxis label={{ value: 'Error Rate (%)', angle: -90, position: 'insideLeft' }} />
                        <Tooltip formatter={(val) => `${val.toFixed(1)}%`} />
                        <Legend />
                        <Bar 
                          dataKey="errorRate" 
                          name="Error Rate (%)" 
                          fill="#FF6B6B" 
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card.Body>
              </Card>
            </Col>

            {/* Average Duration by Step */}
            <Col md={12}>
              <Card className="shadow-sm">
                <Card.Header style={{ backgroundColor: `${toolColor}15` }}>
                  <h6 className="mb-0">Average Duration by Step</h6>
                </Card.Header>
                <Card.Body>
                  <div style={{ height: 300 }}>
                    <ResponsiveContainer>
                      <AreaChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="step" />
                        <YAxis label={{ value: 'Avg Duration (s)', angle: -90, position: 'insideLeft' }} />
                        <Tooltip formatter={(val) => `${val.toFixed(2)} s`} />
                        <Legend />
                        <Area 
                          type="monotone" 
                          dataKey="avgDuration" 
                          name="Avg Duration (s)" 
                          stroke={toolColor} 
                          fill={`${toolColor}33`} 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Tab>

        <Tab eventKey="timeline" title="Execution Timeline">
          <Row className="gy-4">
            {/* Timeline Chart */}
            <Col md={12}>
              <Card className="shadow-sm">
                <Card.Header style={{ backgroundColor: `${toolColor}15` }}>
                  <h6 className="mb-0">Execution Timeline</h6>
                </Card.Header>
                <Card.Body>
                  <div style={{ height: 400 }}>
                    <ResponsiveContainer>
                      <LineChart data={timelineData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="id" 
                          label={{ value: 'Execution ID', position: 'insideBottomRight', offset: -10 }}
                        />
                        <YAxis 
                          yAxisId="left"
                          label={{ value: 'Duration (s)', angle: -90, position: 'insideLeft' }}
                        />
                        <YAxis 
                          yAxisId="right" 
                          orientation="right" 
                          label={{ value: 'Tokens', angle: 90, position: 'insideRight' }}
                        />
                        <Tooltip 
                          formatter={(value, name) => {
                            const unit = name === 'duration' ? 's' : 
                                       (name.includes('Token') ? ' tokens' : '');
                            return [`${value.toFixed(2)}${unit}`, name];
                          }}
                        />
                        <Legend />
                        <Line 
                          yAxisId="left"
                          type="monotone" 
                          dataKey="duration" 
                          name="Duration" 
                          stroke={toolColor} 
                          strokeWidth={2}
                          dot={(props) => {
                            // Customize dot to show error status
                            const { cx, cy, payload } = props;
                            return payload.hasError ? (
                              <svg x={cx - 6} y={cy - 6} width={12} height={12} fill="red" viewBox="0 0 16 16">
                                <circle cx="8" cy="8" r="8" />
                              </svg>
                            ) : (
                              <svg x={cx - 5} y={cy - 5} width={10} height={10} fill={toolColor} viewBox="0 0 16 16">
                                <circle cx="8" cy="8" r="8" />
                              </svg>
                            );
                          }}
                        />
                        <Line 
                          yAxisId="right"
                          type="monotone" 
                          dataKey="promptTokens" 
                          name="Prompt Tokens" 
                          stroke="#FF8042" 
                          strokeDasharray="5 5"
                        />
                        <Line 
                          yAxisId="right"
                          type="monotone" 
                          dataKey="completionTokens" 
                          name="Completion Tokens" 
                          stroke="#8884d8" 
                          strokeDasharray="3 3"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card.Body>
              </Card>
            </Col>

            {/* Step Distribution Timeline */}
            <Col md={12}>
              <Card className="shadow-sm">
                <Card.Header style={{ backgroundColor: `${toolColor}15` }}>
                  <h6 className="mb-0">Step Distribution Timeline</h6>
                </Card.Header>
                <Card.Body>
                  <div style={{ height: 300 }}>
                    <ResponsiveContainer>
                      <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          type="number" 
                          dataKey="id" 
                          name="Execution ID" 
                          label={{ value: 'Execution ID', position: 'insideBottomRight', offset: -10 }}
                        />
                        <YAxis 
                          type="number" 
                          dataKey="step" 
                          name="Step" 
                          label={{ value: 'Step', angle: -90, position: 'insideLeft' }}
                        />
                        <Tooltip formatter={(value, name) => [value, name]} />
                        <Legend />
                        <Scatter 
                          name="Success" 
                          data={timelineData.filter(d => !d.hasError)} 
                          fill={toolColor}
                          shape="circle"
                        />
                        <Scatter 
                          name="Error" 
                          data={timelineData.filter(d => d.hasError)} 
                          fill="#FF6B6B"
                          shape="circle"
                        />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Tab>
      </Tabs>
    </div>
  );
};

export default ToolDetail;