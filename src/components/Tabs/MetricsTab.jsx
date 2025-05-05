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
import { Button, Form, Card, Row, Col, Badge, Container, Spinner } from 'react-bootstrap';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, BarChart, Bar, PieChart, Pie, Cell,
  AreaChart, Area
} from 'recharts';
import Plot from 'react-plotly.js';

const EXTENDED_COLORS = [
  "#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231",
  "#911eb4", "#46f0f0", "#f032e6", "#bcf60c", "#fabebe",
  "#008080", "#e6beff", "#9a6324", "#fffac8", "#800000",
  "#aaffc3", "#808000", "#ffd8b1", "#000075", "#808080"
];

// Custom Badge component for tool selection
const ColoredBadge = ({ color, children, onRemove }) => (
  <span 
    className="badge rounded-pill" 
    style={{ 
      backgroundColor: color, 
      color: "#fff",
      fontSize: '0.875rem', 
      padding: '0.4rem 0.6rem', 
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
          width: '18px',
          height: '18px',
          padding: '0',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: '6px',
          cursor: 'pointer',
          fontSize: '0.75rem',
          fontWeight: 'bold',
          color: 'white'
        }}
      >
        ✕
      </button>
    )}
  </span>
);

// Card with hoverable effect and equal height
const DashboardCard = ({ title, children, className = "", minHeight = "300px", bgColor = "white" }) => (
  <Card 
    className={`shadow-sm ${className}`} 
    style={{ 
      transition: 'transform 0.2s, box-shadow 0.2s',
      minHeight,
      height: '100%',
      backgroundColor: bgColor
    }}
    onMouseOver={(e) => {
      e.currentTarget.style.transform = 'translateY(-3px)';
      e.currentTarget.style.boxShadow = '0 0.25rem 0.75rem rgba(0, 0, 0, 0.15)';
    }}
    onMouseOut={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = '0 0.125rem 0.25rem rgba(0, 0, 0, 0.075)';
    }}
  >
    <Card.Header className="d-flex justify-content-between align-items-center py-2">
      <h6 className="mb-0 fw-bold">{title}</h6>
    </Card.Header>
    <Card.Body className="p-0">
      {children}
    </Card.Body>
  </Card>
);

// KPI Card for showing key metrics
const KpiCard = ({ title, value, unit, icon, color, change }) => (
  <Card 
    className="shadow-sm h-100" 
    style={{ 
      transition: 'transform 0.2s, box-shadow 0.2s',
      borderLeft: `4px solid ${color}`
    }}
    onMouseOver={(e) => {
      e.currentTarget.style.transform = 'translateY(-3px)';
      e.currentTarget.style.boxShadow = '0 0.25rem 0.75rem rgba(0, 0, 0, 0.15)';
    }}
    onMouseOut={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = '0 0.125rem 0.25rem rgba(0, 0, 0, 0.075)';
    }}
  >
    <Card.Body className="d-flex flex-column">
      <div className="d-flex justify-content-between mb-2">
        <span className="text-muted">{title}</span>
        <span className="rounded-circle p-1" style={{ backgroundColor: `${color}22`, color: color }}>
          {icon}
        </span>
      </div>
      <div className="d-flex align-items-baseline mt-auto">
        <h3 className="mb-0 me-1" style={{ color }}>{value}</h3>
        {unit && <small className="text-muted">{unit}</small>}
      </div>
      {change && (
        <small className={change.startsWith('+') ? 'text-success' : 'text-danger'}>
          {change} from previous
        </small>
      )}
    </Card.Body>
  </Card>
);

const MetricsTab = () => {
  const [data, setData] = useState([]);
  const [availableTools, setAvailableTools] = useState([]);
  const [selectedTools, setSelectedTools] = useState([]);
  const [errorData, setErrorData] = useState([]);
  const [scatterData, setScatterData] = useState([]);
  const [boxplotData, setBoxplotData] = useState({ data: [], layout: {} });
  const [heatmapData, setHeatmapData] = useState({ data: [], layout: {} });
  const [tokenData, setTokenData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [successRateData, setSuccessRateData] = useState([]);
  const [toolDistributionData, setToolDistributionData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Create a consistent color mapping for all tools
  const toolColorMap = useMemo(() => {
    const colorMap = {};
    availableTools.forEach((tool, index) => {
      colorMap[tool] = EXTENDED_COLORS[index % EXTENDED_COLORS.length];
    });
    return colorMap;
  }, [availableTools]);

  // Prepare trend data - shows average duration/tokens per step
  const prepareTrendData = (data) => {
    // Group by step
    const stepGroups = {};
    data.forEach(row => {
      if (row.step && selectedTools.includes(row.tool_name)) {
        if (!stepGroups[row.step]) {
          stepGroups[row.step] = [];
        }
        stepGroups[row.step].push(row);
      }
    });

    // Calculate averages per step
    return Object.keys(stepGroups)
      .sort((a, b) => Number(a) - Number(b))
      .map(step => {
        const stepData = stepGroups[step];
        const avgDuration = stepData.reduce((sum, row) => sum + (row.duration || 0), 0) / stepData.length;
        const avgTokens = stepData.reduce((sum, row) => sum + (row.token_count || 0), 0) / stepData.length;
        
        return {
          step: `Step ${step}`,
          avgDuration: parseFloat(avgDuration.toFixed(2)),
          avgTokens: Math.round(avgTokens)
        };
      });
  };

  // Prepare success rate data for pie chart
  const prepareSuccessRateData = (data) => {
    const filteredData = data.filter(row => selectedTools.includes(row.tool_name));
    const totalCalls = filteredData.length;
    
    if (totalCalls === 0) {
      return [
        { name: 'Success', value: 0, percentage: '0.0' },
        { name: 'Error', value: 0, percentage: '0.0' }
      ];
    }
    
    const successfulCalls = filteredData.filter(row => !row.has_error).length;
    
    return [
      { name: 'Success', value: successfulCalls, percentage: ((successfulCalls / totalCalls) * 100).toFixed(1) },
      { name: 'Error', value: totalCalls - successfulCalls, percentage: (((totalCalls - successfulCalls) / totalCalls) * 100).toFixed(1) }
    ];
  };

  // Prepare tool calls distribution by step
  const prepareToolDistributionByStep = (data) => {
    // Group all data by step
    const stepGroups = {};
    data.forEach(row => {
      if (row.step && selectedTools.includes(row.tool_name)) {
        if (!stepGroups[row.step]) {
          stepGroups[row.step] = {
            step: `Step ${row.step}`,
            total: 0
          };
          
          // Initialize count for each tool at this step
          selectedTools.forEach(tool => {
            stepGroups[row.step][tool] = 0;
          });
        }
        
        // Increment the tool count for this step
        stepGroups[row.step][row.tool_name]++;
        stepGroups[row.step].total++;
      }
    });
    
    // Convert to array and sort by step number
    return Object.values(stepGroups).sort((a, b) => {
      return parseInt(a.step.replace('Step ', '')) - parseInt(b.step.replace('Step ', ''));
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

      // Prepare trend data
      const trends = prepareTrendData(data);
      setTrendData(trends);

      // Prepare success rate data
      const successRate = prepareSuccessRateData(data);
      setSuccessRateData(successRate);
      
      // Prepare tool distribution by step data
      const toolDistribution = prepareToolDistributionByStep(data);
      setToolDistributionData(toolDistribution);

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
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '80vh' }}>
        <div className="text-center">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  // Calculate overall metrics for KPI cards
  const overallMetrics = {
    avgDuration: data.filter(row => selectedTools.includes(row.tool_name)).length > 0 
      ? data.filter(row => selectedTools.includes(row.tool_name))
        .reduce((sum, row) => sum + (row.duration || 0), 0) / 
        data.filter(row => selectedTools.includes(row.tool_name)).length
      : 0,
    
    totalCalls: data.filter(row => selectedTools.includes(row.tool_name)).length,
    
    errorRate: data.filter(row => selectedTools.includes(row.tool_name)).length > 0
      ? data.filter(row => selectedTools.includes(row.tool_name) && row.has_error).length / 
        data.filter(row => selectedTools.includes(row.tool_name)).length * 100
      : 0,
    
    avgTokens: data.filter(row => selectedTools.includes(row.tool_name)).length > 0
      ? data.filter(row => selectedTools.includes(row.tool_name))
        .reduce((sum, row) => sum + (row.token_count || 0), 0) / 
        data.filter(row => selectedTools.includes(row.tool_name)).length
      : 0,
  };

  return (
    <Container fluid className="p-3">
      <Row className="mb-3">
        <Col>
          <Card className="shadow-sm">
            <Card.Body>
              <Row>
                <Col md={6}>
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
                </Col>
                <Col md={6}>
                  <h6 className="text-muted mb-2">Selected Tools:</h6>
                  <div>
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
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {selectedTools.length > 0 ? (
        <>
          {/* KPI Cards */}
          <Row className="mb-4 g-3">
            <Col md={3}>
              <KpiCard 
                title="Average Duration"
                value={overallMetrics.avgDuration.toFixed(2)}
                unit="seconds"
                icon="⏱️"
                color="#4363d8"
              />
            </Col>
            <Col md={3}>
              <KpiCard 
                title="Total Tool Calls"
                value={overallMetrics.totalCalls.toLocaleString()}
                icon="🔄"
                color="#3cb44b"
              />
            </Col>
            <Col md={3}>
              <KpiCard 
                title="Error Rate"
                value={overallMetrics.errorRate.toFixed(1)}
                unit="%"
                icon="⚠️"
                color="#e6194b"
              />
            </Col>
            <Col md={3}>
              <KpiCard 
                title="Average Tokens"
                value={Math.round(overallMetrics.avgTokens).toLocaleString()}
                icon="🔤"
                color="#f58231"
              />
            </Col>
          </Row>

          {/* Charts - First Row */}
          <Row className="mb-4 g-3">
            <Col md={7}>
              <DashboardCard title="Error Count by Step">
                <div className="p-3" style={{ height: '300px' }}>
                  <ResponsiveContainer>
                    <LineChart 
                      data={errorData}
                      margin={{ top: 20, right: 30, left: 30, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="step" 
                        label={{ value: 'Step Number', position: 'insideBottomRight', offset: -10 }} 
                      />
                      <YAxis 
                        label={{ value: 'Error Count', angle: -90, position: 'insideLeft', dx: -15 }}
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
                          activeDot={{ r: 4 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </DashboardCard>
            </Col>
            <Col md={5}>
              <DashboardCard title="Success vs Error Rate">
                <div className="d-flex p-3" style={{ height: '300px' }}>
                  <ResponsiveContainer width="60%">
                    <PieChart>
                      <Pie
                        data={successRateData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percentage }) => `${name}: ${percentage}%`}
                      >
                        <Cell key="success" fill="#4caf50" />
                        <Cell key="error" fill="#f44336" />
                      </Pie>
                      <Tooltip formatter={(value, name, props) => [`${props.payload.percentage}% (${value} calls)`, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="d-flex flex-column justify-content-center align-items-start" style={{ width: '40%' }}>
                    <div className="mb-3">
                      <Badge pill bg="success" className="me-2">✓</Badge>
                      <span>Success: {successRateData[0]?.percentage}%</span>
                    </div>
                    <div>
                      <Badge pill bg="danger" className="me-2">✕</Badge>
                      <span>Error: {successRateData[1]?.percentage}%</span>
                    </div>
                  </div>
                </div>
              </DashboardCard>
            </Col>
          </Row>

          {/* Charts - Second Row */}
          <Row className="mb-4 g-3">
            <Col md={6}>
              <DashboardCard title="Duration vs Token Count">
                <div className="p-3" style={{ height: '300px' }}>
                  <ResponsiveContainer>
                    <ScatterChart
                      margin={{ top: 20, right: 30, left: 30, bottom: 20 }}
                    >
                      <CartesianGrid />
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
                        label={{ value: 'Duration (s)', angle: -90, position: 'insideLeft', dx: -15 }} 
                      />
                      <Tooltip cursor={{ strokeDasharray: '3 3' }} />
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
              </DashboardCard>
            </Col>
            <Col md={6}>
              <DashboardCard title="Token Distribution by Tool">
                <div className="p-3" style={{ height: '300px' }}>
                  <ResponsiveContainer>
                    <BarChart
                      data={tokenData}
                      margin={{ top: 20, right: 30, left: 30, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="tool" 
                        label={{ value: 'Tool', position: 'insideBottom', offset: -10 }}
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
                        height={40}
                      />
                      <YAxis 
                        label={{ value: 'Token Count', angle: -90, position: 'insideLeft', dx: -15 }}
                      />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="prompt" name="Prompt Tokens" stackId="a" fill="#FF4444" />
                      <Bar dataKey="completion" name="Completion Tokens" stackId="a" fill="#FFA500" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </DashboardCard>
            </Col>
          </Row>

          {/* Charts - Third Row */}
          <Row className="mb-4 g-3">
            <Col md={6}>
              <DashboardCard title="Distribution of Tool Calls by Step">
                <div className="p-3" style={{ height: '300px' }}>
                  <ResponsiveContainer>
                    <BarChart
                      data={toolDistributionData}
                      margin={{ top: 20, right: 30, left: 30, bottom: 20 }}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis 
                        type="category" 
                        dataKey="step" 
                        width={70}
                      />
                      <Tooltip 
                        formatter={(value, name, props) => {
                          // Calculate percentage
                          const percentage = (value / props.payload.total * 100).toFixed(1);
                          return [`${value} calls (${percentage}%)`, name];
                        }}
                      />
                      <Legend />
                      {selectedTools.map((tool) => (
                        <Bar
                          key={tool}
                          dataKey={tool}
                          name={tool}
                          stackId="a"
                          fill={toolColorMap[tool] || EXTENDED_COLORS[0]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </DashboardCard>
            </Col>
            <Col md={6}>
              <DashboardCard title="Trend Analysis by Step">
                <div className="p-3" style={{ height: '300px' }}>
                  <ResponsiveContainer>
                    <AreaChart
                      data={trendData}
                      margin={{ top: 20, right: 30, left: 30, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="step" />
                      <YAxis 
                        yAxisId="left" 
                        label={{ value: 'Avg Duration (s)', angle: -90, position: 'insideLeft', dx: -15 }} 
                      />
                      <YAxis 
                        yAxisId="right" 
                        orientation="right" 
                        label={{ value: 'Avg Tokens', angle: 90, position: 'insideRight', dx: 15 }} 
                      />
                      <Tooltip />
                      <Legend />
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="avgDuration"
                        name="Avg Duration"
                        stroke="#8884d8"
                        fill="#8884d8"
                        fillOpacity={0.3}
                      />
                      <Area
                        yAxisId="right"
                        type="monotone"
                        dataKey="avgTokens"
                        name="Avg Tokens"
                        stroke="#82ca9d"
                        fill="#82ca9d"
                        fillOpacity={0.3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </DashboardCard>
            </Col>
          </Row>
          
          {/* Boxplot & Heatmap */}
          <Row className="g-3">
            <Col md={12}>
              <DashboardCard title="Runtime Distribution Boxplots">
                <div className="p-3" style={{ height: '400px' }}>
                  <Plot
                    data={boxplotData.data}
                    layout={boxplotData.layout}
                    config={{ responsive: true }}
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>
              </DashboardCard>
            </Col>
            <Col md={12}>
              <DashboardCard title="Duration Heatmap (Tool × Step)">
                <div className="p-3" style={{ height: '400px' }}>
                  <Plot
                    data={heatmapData.data}
                    layout={heatmapData.layout}
                    config={{ responsive: true }}
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>
              </DashboardCard>
            </Col>
          </Row>
        </>
      ) : (
        <div className="text-center p-5 bg-light rounded shadow-sm">
          <h5>No Tools Selected</h5>
          <p>Please select tools from the dropdown above to view the dashboard metrics.</p>
          <Button variant="primary" onClick={() => setSelectedTools(availableTools.slice(0, 5))}>
            Add Default Tools
          </Button>
        </div>
      )}
    </Container>
  );
};

export default MetricsTab;