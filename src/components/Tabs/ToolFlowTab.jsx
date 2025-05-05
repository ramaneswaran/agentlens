import React, { useEffect, useState } from "react";
import Plot from "react-plotly.js";
import Papa from "papaparse";
import { extractUniqueTools } from "../../utils/dataProcessing";
import { Card, Row, Col, Badge, Form, Button, ButtonGroup } from "react-bootstrap";

const EXTENDED_COLORS = [
  "#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231",
  "#911eb4", "#46f0f0", "#f032e6", "#bcf60c", "#fabebe",
  "#008080", "#e6beff", "#9a6324", "#fffac8", "#800000",
  "#aaffc3", "#808000", "#ffd8b1", "#000075", "#808080"
];

// Constants for error styling
const ERROR_COLOR_MODIFIER = "99"; // 60% opacity - lighter color
const ERROR_BORDER_COLOR = "#ff0000"; // Red border for error nodes
const ERROR_BORDER_WIDTH = 2; // Border width for error nodes

// Custom Badge component to ensure styling is applied
const ColoredBadge = ({ color, children, hasError = false }) => (
  <span 
    className="badge rounded-pill" 
    style={{ 
      backgroundColor: color, 
      color: "#fff",
      fontSize: '0.9rem',
      padding: '0.5rem 0.8rem',
      margin: '0.2rem',
      display: 'inline-block',
      fontWeight: '500',
      border: hasError ? `2px solid ${ERROR_BORDER_COLOR}` : 'none'
    }}
  >
    {children}
    {hasError && (
      <span 
        style={{ 
          marginLeft: '5px', 
          backgroundColor: 'rgba(255,255,255,0.3)', 
          borderRadius: '50%',
          width: '18px',
          height: '18px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.7rem'
        }}
      >
        ⚠️
      </span>
    )}
  </span>
);

function ToolFlowTab() {
  const [sankeyData, setSankeyData] = useState(null);
  const [uniqueTools, setUniqueTools] = useState([]);
  const [toolColorMap, setToolColorMap] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState("all"); // "all" or "errors"
  const [errorStats, setErrorStats] = useState({ total: 0, byTool: {} });

  useEffect(() => {
    setIsLoading(true);
    fetch("/agent_metrics.csv")
      .then(res => res.text())
      .then(csvText => {
        const parsed = Papa.parse(csvText, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true
        }).data;

        // Extract unique tools for consistent color mapping
        const tools = extractUniqueTools(parsed);
        setUniqueTools(tools);
        
        // Create a consistent color map
        const colorMap = {};
        tools.forEach((tool, index) => {
          colorMap[tool] = EXTENDED_COLORS[index % EXTENDED_COLORS.length];
        });
        
        setToolColorMap(colorMap);
        
        // Calculate error statistics
        const errorCount = parsed.filter(row => row.has_error).length;
        const errorByTool = {};
        tools.forEach(tool => {
          const toolRows = parsed.filter(row => row.tool_name === tool);
          const toolErrorCount = toolRows.filter(row => row.has_error).length;
          errorByTool[tool] = {
            count: toolErrorCount,
            percentage: toolRows.length > 0 ? toolErrorCount / toolRows.length * 100 : 0
          };
        });
        
        setErrorStats({
          total: errorCount,
          totalPercentage: errorCount / parsed.length * 100,
          byTool: errorByTool
        });
        
        // Prepare Sankey data
        const sankey = prepareSankeyData(parsed, colorMap);
        setSankeyData(sankey);
        setIsLoading(false);
      })
      .catch(error => {
        console.error("Error loading or parsing CSV:", error);
        setIsLoading(false);
      });
  }, []);

  // Import the enhanced prepareSankeyData function from dataProcessing.js
  const prepareSankeyData = (data, colorMap) => {
    // This is a simplified wrapper around the utility function
    // In a real implementation, we would import this from dataProcessing.js
    
    const toolSet = new Set();
    const nodeIndexMap = new Map(); // maps "tool @ step" => node index
    const nodes = [];
    const links = [];
    let nodeId = 0;

    // Group data by subdir
    const groupedByUseCase = {};
    data.forEach(row => {
      if (!row.subdir || !row.tool_name || row.step === undefined) return;

      toolSet.add(row.tool_name);

      if (!groupedByUseCase[row.subdir]) {
        groupedByUseCase[row.subdir] = [];
      }
      groupedByUseCase[row.subdir].push(row);
    });

    Object.entries(groupedByUseCase).forEach(([subdir, rows]) => {
      // Steps used by this subdir
      const steps = [...new Set(rows.map(r => r.step))].sort((a, b) => a - b);
      const stepMap = {};
      steps.forEach(step => {
        stepMap[step] = [...new Set(rows.filter(r => r.step === step).map(r => r.tool_name))];
      });

      const stepCount = steps.length;

      // Add nodes and links
      steps.forEach((step, i) => {
        const normalizedX = i / (stepCount - 1 || 1);  // avoid divide by 0

        stepMap[step].forEach(tool => {
          // Calculate error statistics for this tool at this step
          const toolStepRows = rows.filter(r => 
            r.step === step && r.tool_name === tool
          );
          
          const errorRows = toolStepRows.filter(r => r.has_error);
          const hasErrors = errorRows.length > 0;
          const errorRate = toolStepRows.length > 0 
            ? errorRows.length / toolStepRows.length 
            : 0;
            
          // Skip this node if we're in error view mode and it has no errors
          if (viewMode === "errors" && !hasErrors) {
            return;
          }

          const key = `${tool} @ Step ${step}`;
          if (!nodeIndexMap.has(key)) {
            nodeIndexMap.set(key, nodeId);
            nodes.push({ 
              name: key, 
              tool, 
              step, 
              x: normalizedX,
              hasErrors,
              errorCount: errorRows.length,
              totalCount: toolStepRows.length,
              errorRate
            });
            nodeId++;
          }
        });

        if (i < steps.length - 1) {
          const fromStep = step;
          const toStep = steps[i + 1];

          stepMap[fromStep].forEach(fromTool => {
            // Skip if from-node doesn't exist (filtered out in error view)
            const fromKey = `${fromTool} @ Step ${fromStep}`;
            if (!nodeIndexMap.has(fromKey)) return;
            
            stepMap[toStep].forEach(toTool => {
              // Skip if to-node doesn't exist (filtered out in error view)
              const toKey = `${toTool} @ Step ${toStep}`;
              if (!nodeIndexMap.has(toKey)) return;
              
              // Count normal and error transitions
              const source = nodeIndexMap.get(fromKey);
              const target = nodeIndexMap.get(toKey);
              
              if (source != null && target != null) {
                // Count transitions and error transitions
                const transitions = rows.filter(r => {
                  return r.step === fromStep && r.tool_name === fromTool &&
                         rows.some(next => 
                           next.subdir === r.subdir && 
                           next.step === toStep && 
                           next.tool_name === toTool
                         );
                });
                
                const errorTransitions = transitions.filter(r => r.has_error);
                const hasErrors = errorTransitions.length > 0;
                
                // Skip links with no errors if in error view mode
                if (viewMode === "errors" && !hasErrors) return;
                
                if (transitions.length > 0) {
                  const existing = links.find(l => l.source === source && l.target === target);
                  if (existing) {
                    existing.value += transitions.length;
                    existing.errorCount = (existing.errorCount || 0) + errorTransitions.length;
                    existing.hasErrors = existing.hasErrors || hasErrors;
                  } else {
                    links.push({ 
                      source, 
                      target, 
                      value: transitions.length,
                      errorCount: errorTransitions.length,
                      hasErrors
                    });
                  }
                }
              }
            });
          });
        }
      });
    });

    const nodeX = nodes.map(n => n.x);
    const maxStep = Math.max(...nodes.map(n => n.step || 0), 1);

    return {
      nodes,
      links,
      toolColors: colorMap,
      stepCount: maxStep,
      nodeX,
      viewMode
    };
  };

  // Toggle between all view and error view
  const toggleViewMode = () => {
    // Update view mode state
    const newMode = viewMode === "all" ? "errors" : "all";
    setViewMode(newMode);
    
    // Show loading indicator
    setIsLoading(true);
    
    // Regenerate Sankey data with the new view mode
    fetch("/agent_metrics.csv")
      .then(res => res.text())
      .then(csvText => {
        const parsed = Papa.parse(csvText, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true
        }).data;
        
        // Update view with new mode
        const sankey = prepareSankeyData(parsed, toolColorMap);
        setSankeyData(sankey);
        setIsLoading(false);
      })
      .catch(error => {
        console.error("Error toggling view mode:", error);
        setIsLoading(false);
      });
  };

  // Display loading state
  if (isLoading) return <div className="p-4">Loading Sankey diagram...</div>;
  
  // Handle case when data is loaded but empty
  if (!sankeyData || !sankeyData.nodes || sankeyData.nodes.length === 0) {
    return <div className="p-4">No data available for visualization.</div>;
  }

  const { nodes, links, toolColors, stepCount, nodeX } = sankeyData;

  // Create customdata arrays for hover information
  const nodeCustomdata = nodes.map(n => ({ 
    tool: n.tool, 
    step: n.step,
    hasErrors: n.hasErrors,
    errorCount: n.errorCount,
    totalCount: n.totalCount,
    errorRate: n.errorRate
  }));
  
  const nodeLabels = nodes.map(n => n.tool); // Use tool name for the node label
  
  // Adjust node colors based on error status
  const nodeColors = nodes.map(n => {
    const baseColor = toolColors[n.tool] || "#888";
    
    if (n.hasErrors) {
      // For error nodes, use a modified color or add a border
      return baseColor + ERROR_COLOR_MODIFIER; // Add transparency to indicate error
    }
    
    return baseColor;
  });
  
  // Define node line color and width based on error status
  const nodeLineColors = nodes.map(n => 
    n.hasErrors ? ERROR_BORDER_COLOR : "rgba(0,0,0,0.3)"
  );
  
  const nodeLineWidths = nodes.map(n => 
    n.hasErrors ? ERROR_BORDER_WIDTH : 0.5
  );

  const stepLabels = Array.from({ length: stepCount }, (_, i) => `Step ${i + 1}`);
  const xTickVals = Array.from({ length: stepCount }, (_, i) => i / (stepCount - 1));

  // Construct custom hover tooltips for links
  const linkCustomdata = links.map(l => {
    const sourceNode = nodes[l.source];
    const targetNode = nodes[l.target];
    return {
      sourceLabel: sourceNode.name,
      targetLabel: targetNode.name,
      sourceTool: sourceNode.tool,
      targetTool: targetNode.tool,
      sourceStep: sourceNode.step,
      targetStep: targetNode.step,
      hasErrors: l.hasErrors,
      errorCount: l.errorCount,
      totalCount: l.value
    };
  });
  
  // Color the links based on error status
  const linkColors = links.map(l => 
    l.hasErrors ? "rgba(255,0,0,0.2)" : "rgba(100,100,100,0.2)"
  );

  return (
    <Card className="p-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">Tool Flow Sankey</h5>
        <ButtonGroup>
          <Button 
            variant={viewMode === "all" ? "primary" : "outline-primary"}
            onClick={() => toggleViewMode()}
          >
            All Tools
          </Button>
          <Button 
            variant={viewMode === "errors" ? "danger" : "outline-danger"}
            onClick={() => toggleViewMode()}
          >
            Error View {errorStats.total > 0 && `(${errorStats.total})`}
          </Button>
        </ButtonGroup>
      </div>

      {viewMode === "errors" && (
        <div className="alert alert-info mb-3">
          <strong>Error View:</strong> Showing only tools with errors. The diagram displays error interactions across steps.
        </div>
      )}

      <div className="mb-4">
        <h6 className="text-muted mb-2">Tool Legend:</h6>
        <div className="d-flex flex-wrap">
          {uniqueTools.map(tool => {
            const hasError = errorStats.byTool[tool]?.count > 0;
            
            // Skip tools with no errors in error view
            if (viewMode === "errors" && !hasError) return null;
            
            return (
              <ColoredBadge 
                key={tool} 
                color={toolColors[tool]}
                hasError={hasError}
              >
                {tool}
                {hasError && (
                  <span className="ms-1 small">
                    ({errorStats.byTool[tool].percentage.toFixed(1)}%)
                  </span>
                )}
              </ColoredBadge>
            );
          })}
        </div>
      </div>

      <div style={{ width: '100%', height: 700 }}>
        <Plot
          data={[
            {
              type: 'sankey',
              orientation: 'h',
              node: {
                label: nodeLabels,
                color: nodeColors,
                line: {
                  color: nodeLineColors,
                  width: nodeLineWidths
                },
                pad: 15,
                thickness: 24,
                x: nodeX,
                customdata: nodeCustomdata,
                hovertemplate: 
                  '<b>%{customdata.tool}</b> (Step %{customdata.step})<br>' +
                  'Total Calls: %{customdata.totalCount}<br>' +
                  '%{customdata.hasErrors ? "<b style=\'color:red\'>Errors: " + customdata.errorCount + "</b><br>Error Rate: " + (customdata.errorRate * 100).toFixed(1) + "%" : "No Errors"}' +
                  '<extra></extra>'
              },
              link: {
                source: links.map(l => l.source),
                target: links.map(l => l.target),
                value: links.map(l => l.value),
                color: linkColors,
                customdata: linkCustomdata,
                hovertemplate:
                  '<b>Transition</b><br>' +
                  'From: <b>%{customdata.sourceTool}</b> (Step %{customdata.sourceStep})<br>' +
                  'To: <b>%{customdata.targetTool}</b> (Step %{customdata.targetStep})<br>' +
                  'Total Calls: %{customdata.totalCount}<br>' +
                  '%{customdata.hasErrors ? "<b style=\'color:red\'>Error Calls: " + customdata.errorCount + "</b><br>Error Rate: " + (customdata.errorCount/customdata.totalCount*100).toFixed(1) + "%" : "No Errors"}' +
                  '<extra></extra>',
              },
            },
          ]}
          layout={{
            title: {
              text: viewMode === "all" 
                ? 'Tool transitions across Agentic Steps' 
                : 'Error transitions across Agentic Steps',
              font: { 
                size: 16,
                color: viewMode === "errors" ? '#dc3545' : '#333' 
              }
            },
            font: { size: 12 },
            height: 700,
            width: 1200,
            autosize: true,
            margin: { t: 80, l: 30, r: 30, b: 80 },
            plot_bgcolor: viewMode === "errors" ? 'rgba(255,235,235,0.2)' : '#fff',
            xaxis: {
              tickvals: xTickVals,
              ticktext: stepLabels,
              showticklabels: true,
              showgrid: false,
              zeroline: false
            },
            annotations: xTickVals.map((x, i) => ({
              x,
              y: -0.1,
              xref: 'paper',
              yref: 'paper',
              text: stepLabels[i],
              showarrow: false,
              font: { size: 14 }
            }))
          }}
          config={{ 
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['lasso2d', 'select2d'],
            toImageButtonOptions: {
              format: 'png',
              filename: 'tool_flow_sankey',
              height: 700,
              width: 1200,
              scale: 2
            }
          }}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
      
      {/* Error Statistics Panel */}
      <Card className="mt-4">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Error Statistics</h5>
          <span className="badge bg-danger">
            {errorStats.total} Errors ({errorStats.totalPercentage?.toFixed(1)}%)
          </span>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={5}>
              <h6>Overall Error Rate</h6>
              <div className="progress mb-3" style={{ height: '25px' }}>
                <div 
                  className="progress-bar bg-danger" 
                  role="progressbar" 
                  style={{ width: `${errorStats.totalPercentage}%` }}
                  aria-valuenow={errorStats.totalPercentage} 
                  aria-valuemin="0" 
                  aria-valuemax="100"
                >
                  {errorStats.totalPercentage?.toFixed(1)}%
                </div>
              </div>
              <div className="alert alert-light border p-2 mt-3">
                <p className="mb-1"><strong>Error View Instructions:</strong></p>
                <ul className="mb-0 ps-3">
                  <li>Click "Error View" to focus only on steps with errors</li>
                  <li>Nodes with errors have a red border</li>
                  <li>Error transitions are highlighted with red paths</li>
                  <li>Hover over nodes/links for detailed error statistics</li>
                </ul>
              </div>
            </Col>
            <Col md={7}>
              <h6>Error Rate by Tool</h6>
              <div className="d-flex flex-wrap">
                {Object.entries(errorStats.byTool)
                  .filter(([_, stats]) => stats.count > 0)
                  .sort((a, b) => b[1].percentage - a[1].percentage)
                  .map(([tool, stats]) => (
                    <Badge 
                      key={tool} 
                      bg="light" 
                      text="dark" 
                      className="me-2 mb-2"
                      style={{
                        borderLeft: `3px solid ${toolColors[tool]}`,
                        padding: '0.4rem 0.6rem',
                      }}
                    >
                      <span style={{ fontWeight: 'bold' }}>{tool}</span>: 
                      <span className="text-danger ms-1 fw-bold">{stats.count}</span> errors 
                      (<span className="text-danger">{stats.percentage.toFixed(1)}%</span>)
                    </Badge>
                  ))
                }
              </div>
              
              {Object.keys(errorStats.byTool).filter(tool => errorStats.byTool[tool].count > 0).length === 0 && (
                <div className="alert alert-success">
                  No errors detected in the dataset.
                </div>
              )}
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </Card>
  );
}

export default ToolFlowTab;