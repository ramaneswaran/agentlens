import React, { useEffect, useState } from "react";
import Plot from "react-plotly.js";
import Papa from "papaparse";
import { extractUniqueTools } from "../../utils/dataProcessing";
import { Card, Row, Col, Badge, ButtonGroup, Button } from "react-bootstrap";

const EXTENDED_COLORS = [
  "#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231",
  "#911eb4", "#46f0f0", "#f032e6", "#bcf60c", "#fabebe",
  "#008080", "#e6beff", "#9a6324", "#fffac8", "#800000",
  "#aaffc3", "#808000", "#ffd8b1", "#000075", "#808080"
];

// Constants for styling
const ERROR_NODE_COLOR = "#ff3333";
const NORMAL_LINK_COLOR = "rgba(100,100,100,0.2)";
const ERROR_LINK_COLOR = "rgba(255,0,0,0.5)";

// Custom Badge component
const ColoredBadge = ({ color, children }) => (
  <span 
    className="badge rounded-pill" 
    style={{ 
      backgroundColor: color, 
      color: "#fff",
      fontSize: '0.9rem',
      padding: '0.5rem 0.8rem',
      margin: '0.2rem',
      display: 'inline-block',
      fontWeight: '500'
    }}
  >
    {children}
  </span>
);

function ToolFlowTab() {
  const [sankeyData, setSankeyData] = useState(null);
  const [uniqueTools, setUniqueTools] = useState([]);
  const [toolColorMap, setToolColorMap] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState("normal"); // "normal" or "errors"
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
          totalPercentage: parsed.length > 0 ? errorCount / parsed.length * 100 : 0,
          byTool: errorByTool
        });
        
        // Prepare Sankey data
        const sankey = prepareSankeyData(parsed, colorMap, viewMode);
        setSankeyData(sankey);
        setIsLoading(false);
      })
      .catch(error => {
        console.error("Error loading or parsing CSV:", error);
        setIsLoading(false);
      });
  }, [viewMode]);

  // Enhanced Sankey data preparation function with ONE error node between steps
  // Also handling leaf node errors properly
  const prepareSankeyData = (data, colorMap, viewMode) => {
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

    // Identify all unique steps across all use cases
    const allSteps = [...new Set(data.filter(row => row.step !== undefined).map(row => row.step))].sort((a, b) => a - b);
    
    // Create error nodes map - just one per step transition
    const errorNodeIds = new Map(); // "step1-step2" -> nodeId for error node
    
    // Also create terminal error nodes for the last step
    let terminalErrorNodeId = null;
    
    // First pass: Create all tool nodes at each step
    allSteps.forEach((step, i) => {
      const normalizedX = i / (allSteps.length - 1 || 1);  // avoid divide by 0
      
      // Get all tools at this step across all use cases
      const toolsAtStep = [...new Set(data.filter(row => row.step === step).map(row => row.tool_name))];
      
      // Create nodes for each tool at this step
      toolsAtStep.forEach(tool => {
        const toolStepRows = data.filter(row => row.step === step && row.tool_name === tool);
        
        const errorRows = toolStepRows.filter(row => row.has_error);
        const hasErrors = errorRows.length > 0;
        const errorRate = toolStepRows.length > 0 
          ? errorRows.length / toolStepRows.length 
          : 0;

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
            errorRate,
            isErrorNode: false
          });
          nodeId++;
        }
      });
      
      // Create ONE error node between this step and the next step (if there is a next step)
      if (i < allSteps.length - 1) {
        const nextStep = allSteps[i + 1];
        
        // Check if there are any errors in this step
        const hasErrorsInStep = data.some(row => row.step === step && row.has_error);
        
        // Only create error node if in error view or if there are actual errors
        if ((viewMode === "errors" && hasErrorsInStep) || (viewMode === "errors" && i === allSteps.length - 2)) {
          // Calculate position between steps
          const nextNormalizedX = (i + 1) / (allSteps.length - 1 || 1);
          const errorNodeX = (normalizedX + nextNormalizedX) / 2;
          
          // Create exactly ONE error node between these steps
          const errorNodeKey = `Error: Step ${step} → ${nextStep}`;
          
          // Track the error node ID for link creation
          errorNodeIds.set(`${step}-${nextStep}`, nodeId);
          
          nodes.push({
            name: errorNodeKey,
            tool: "Error",
            step: step + 0.5, // Position between steps
            x: errorNodeX,
            isErrorNode: true,
            fromStep: step,
            toStep: nextStep,
            errorCount: data.filter(row => row.step === step && row.has_error).length
          });
          
          nodeId++;
        }
      }
      
      // For the last step, create a terminal error node if needed (in error view only)
      if (i === allSteps.length - 1 && viewMode === "errors") {
        const hasErrorsInLastStep = data.some(row => row.step === step && row.has_error);
        
        if (hasErrorsInLastStep) {
          // Position it to the right of the last step
          const terminalErrorNodeX = normalizedX + 0.15;
          
          // Create terminal error node
          const terminalErrorNodeKey = `Error: Step ${step} (Terminal)`;
          
          terminalErrorNodeId = nodeId;
          
          nodes.push({
            name: terminalErrorNodeKey,
            tool: "Terminal Error",
            step: step + 0.5,
            x: terminalErrorNodeX,
            isErrorNode: true,
            fromStep: step,
            toStep: null,
            isTerminal: true,
            errorCount: data.filter(row => row.step === step && row.has_error).length
          });
          
          nodeId++;
        }
      }
    });
    
    // Second pass: Create links
    Object.entries(groupedByUseCase).forEach(([subdir, rows]) => {
      const useCaseSteps = [...new Set(rows.map(r => r.step))].sort((a, b) => a - b);
      
      useCaseSteps.forEach((step, i) => {
        // Get tools at this step for this use case
        const toolsAtStep = [...new Set(rows.filter(r => r.step === step).map(r => r.tool_name))];
        
        // Is this the last step for this use case?
        const isLastStep = i === useCaseSteps.length - 1;
        
        toolsAtStep.forEach(tool => {
          const toolKey = `${tool} @ Step ${step}`;
          const source = nodeIndexMap.get(toolKey);
          
          if (source === undefined) return;
          
          // Get rows for this tool at this step
          const toolRows = rows.filter(r => r.step === step && r.tool_name === tool);
          
          // Split into error and non-error rows
          const errorRows = toolRows.filter(r => r.has_error);
          const nonErrorRows = toolRows.filter(r => !r.has_error);
          
          // Handle errors differently based on if it's a terminal step or not
          if (errorRows.length > 0 && viewMode === "errors") {
            if (isLastStep && terminalErrorNodeId !== null) {
              // Terminal step errors go to terminal error node
              links.push({
                source,
                target: terminalErrorNodeId,
                value: errorRows.length,
                isErrorLink: true
              });
            } else if (!isLastStep) {
              // Non-terminal errors go to the error node for the next step
              const nextStep = useCaseSteps[i + 1];
              const errorNodeId = errorNodeIds.get(`${step}-${nextStep}`);
              
              if (errorNodeId !== undefined) {
                links.push({
                  source,
                  target: errorNodeId,
                  value: errorRows.length,
                  isErrorLink: true
                });
              }
            }
          }
          
          // Create links for successful transitions (only if not the last step)
          if (!isLastStep) {
            const nextStep = useCaseSteps[i + 1];
            
            // Identify the next tools this tool connects to when successful
            const nextToolsSet = new Set();
            
            nonErrorRows.forEach(row => {
              // Find the next tools this row connects to
              const nextTools = rows.filter(nextRow => 
                nextRow.subdir === row.subdir && 
                nextRow.step === nextStep
              ).map(nextRow => nextRow.tool_name);
              
              nextTools.forEach(nextTool => nextToolsSet.add(nextTool));
            });
            
            // Create links to each next tool
            [...nextToolsSet].forEach(nextTool => {
              const targetKey = `${nextTool} @ Step ${nextStep}`;
              const target = nodeIndexMap.get(targetKey);
              
              if (target === undefined) return;
              
              // Count successful transitions to this specific next tool
              const transitionCount = rows.filter(r => 
                r.step === step && 
                r.tool_name === tool && 
                !r.has_error && 
                rows.some(next => 
                  next.subdir === r.subdir && 
                  next.step === nextStep && 
                  next.tool_name === nextTool
                )
              ).length;
              
              if (transitionCount > 0) {
                // Check if this link already exists
                const existingLink = links.find(l => 
                  l.source === source && l.target === target
                );
                
                if (existingLink) {
                  existingLink.value += transitionCount;
                } else {
                  links.push({
                    source,
                    target,
                    value: transitionCount,
                    isErrorLink: false
                  });
                }
              }
            });
          }
        });
        
        // Create links from error node to next steps if in error view and not the last step
        if (viewMode === "errors" && !isLastStep) {
          const nextStep = useCaseSteps[i + 1];
          const errorNodeId = errorNodeIds.get(`${step}-${nextStep}`);
          
          if (errorNodeId !== undefined) {
            // Find all next tools that receive flow after errors
            const nextToolsAfterError = [...new Set(
              rows.filter(r => r.step === step && r.has_error)
                .flatMap(errorRow => {
                  // For each error, find the tools in the next step in the same use case
                  return rows.filter(nextRow => 
                    nextRow.subdir === errorRow.subdir && 
                    nextRow.step === nextStep
                  ).map(nextRow => nextRow.tool_name);
                })
            )];
            
            nextToolsAfterError.forEach(nextTool => {
              const targetKey = `${nextTool} @ Step ${nextStep}`;
              const target = nodeIndexMap.get(targetKey);
              
              if (target === undefined) return;
              
              // Count error transitions that flow to this next tool
              const errorToToolCount = rows.filter(r => 
                r.step === step && 
                r.has_error && 
                rows.some(next => 
                  next.subdir === r.subdir && 
                  next.step === nextStep && 
                  next.tool_name === nextTool
                )
              ).length;
              
              if (errorToToolCount > 0) {
                links.push({
                  source: errorNodeId,
                  target,
                  value: errorToToolCount,
                  isErrorLink: true
                });
              }
            });
          }
        }
      });
    });

    const nodeX = nodes.map(n => n.x);
    const maxStep = Math.max(...nodes.filter(n => !n.isErrorNode).map(n => n.step || 0), 1);

    return {
      nodes,
      links,
      toolColors: colorMap,
      stepCount: maxStep,
      nodeX,
      viewMode
    };
  };

  // Toggle between normal view and error view
  const toggleViewMode = () => {
    setViewMode(viewMode === "normal" ? "errors" : "normal");
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
    errorRate: n.errorRate,
    isErrorNode: n.isErrorNode,
    fromStep: n.fromStep,
    toStep: n.toStep,
    isTerminal: n.isTerminal
  }));
  
  // Use normal node labels with special formatting for error nodes
  const nodeLabels = nodes.map(n => {
    if (!n.isErrorNode) return n.tool;
    if (n.isTerminal) return "⚠️ Terminal Errors";
    return "⚠️ Error";
  }); 
  
  // Assign colors - error nodes are always red
  const nodeColors = nodes.map(n => 
    n.isErrorNode ? ERROR_NODE_COLOR : (toolColors[n.tool] || "#888")
  );
  
  // Make error nodes slightly larger
  const nodePadding = nodes.map(n => n.isErrorNode ? 20 : 15);
  const nodeThickness = nodes.map(n => n.isErrorNode ? 30 : 24);
  
  // Link coloring based on error status
  const linkColors = links.map(l => l.isErrorLink ? ERROR_LINK_COLOR : NORMAL_LINK_COLOR);

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
      isErrorLink: l.isErrorLink,
      count: l.value
    };
  });
  
  // Create node hover template
  const nodeHoverTemplate = '<b>%{label}</b><br>' +
    '%{customdata.isErrorNode ? (customdata.isTerminal ? "Terminal errors at Step " + customdata.fromStep + "<br>Error Count: " + customdata.errorCount : "Between Step " + customdata.fromStep + " and Step " + customdata.toStep + "<br>Error Count: " + customdata.errorCount) : "Step " + customdata.step}' +
    '%{customdata.isErrorNode ? "" : "<br>Total Calls: " + customdata.totalCount}' +
    '%{customdata.hasErrors && !customdata.isErrorNode && customdata.viewMode === "errors" ? "<br><b style=\'color:red\'>Errors: " + customdata.errorCount + "</b><br>Error Rate: " + (customdata.errorRate * 100).toFixed(1) + "%" : ""}' +
    '<extra></extra>';
  
  // Create link hover template
  const linkHoverTemplate = '<b>%{customdata.isErrorLink ? "Error Flow" : "Flow"}</b><br>' +
    'From: <b>%{customdata.sourceTool}</b><br>' +
    'To: <b>%{customdata.targetTool}</b><br>' +
    'Count: %{customdata.count}' +
    '<extra></extra>';

  return (
    <Card className="p-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">Tool Flow Sankey</h5>
        <ButtonGroup>
          <Button 
            variant={viewMode === "normal" ? "primary" : "outline-primary"}
            onClick={() => toggleViewMode()}
          >
            Normal View
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
          <strong>Error View:</strong> Red nodes represent errors between steps. Red links show error transitions. Terminal errors are shown at the end of the flow.
        </div>
      )}

      <div className="mb-4">
        <h6 className="text-muted mb-2">Tool Legend:</h6>
        <div className="d-flex flex-wrap">
          {uniqueTools.map(tool => (
            <ColoredBadge 
              key={tool} 
              color={toolColors[tool]}
            >
              {tool}
              {viewMode === "errors" && errorStats.byTool[tool]?.count > 0 && (
                <span className="ms-1 small">
                  ({errorStats.byTool[tool].percentage.toFixed(1)}%)
                </span>
              )}
            </ColoredBadge>
          ))}
          {viewMode === "errors" && (
            <>
              <ColoredBadge color={ERROR_NODE_COLOR}>
                ⚠️ Error Node
              </ColoredBadge>
              <ColoredBadge color={ERROR_NODE_COLOR}>
                ⚠️ Terminal Errors
              </ColoredBadge>
            </>
          )}
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
                pad: nodePadding,
                thickness: nodeThickness,
                x: nodeX,
                customdata: nodeCustomdata,
                hovertemplate: nodeHoverTemplate
              },
              link: {
                source: links.map(l => l.source),
                target: links.map(l => l.target),
                value: links.map(l => l.value),
                color: linkColors,
                customdata: linkCustomdata,
                hovertemplate: linkHoverTemplate
              },
            },
          ]}
          layout={{
            title: {
              text: viewMode === "normal" 
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
      
      {/* Only show Error Statistics Panel in error view */}
      {viewMode === "errors" && (
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
              </Col>
            </Row>
          </Card.Body>
        </Card>
      )}
    </Card>
  );
}

export default ToolFlowTab;