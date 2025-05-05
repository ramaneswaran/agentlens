// src/utils/dataProcessing.js
import Papa from 'papaparse';
import _ from 'lodash';

/**
 * Load and parse CSV data from a file
 * @param {String} filePath - The path to the CSV file
 * @returns {Promise<Array>} - Parsed data as an array of objects
 */
export const loadCSVData = async (filePath) => {
  try {
    // Use fetch API instead of fs
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${filePath}: ${response.statusText}`);
    }
    
    const fileContent = await response.text();
    
    return new Promise((resolve, reject) => {
      Papa.parse(fileContent, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            console.warn('CSV parsing had errors:', results.errors);
          }
          resolve(results.data);
        },
        error: (error) => reject(error)
      });
    });
  } catch (error) {
    console.error('Error loading CSV data:', error);
    throw error;
  }
};

/**
 * Extract unique tools from the dataset
 * @param {Array} data - The parsed CSV data
 * @returns {Array} - Array of unique tool names
 */
export const extractUniqueTools = (data) => {
  return _.uniq(data.map(row => row.tool_name)).filter(Boolean).sort();
};

/**
 * Extract unique use cases (subdirectories) from the dataset
 * @param {Array} data - The parsed CSV data
 * @returns {Array} - Array of unique subdirectory names
 */
export const extractUniqueUseCases = (data) => {
  return _.uniq(data.map(row => row.subdir)).filter(Boolean).sort();
};

/**
 * Calculate summary statistics for a tool
 * @param {Array} data - The parsed CSV data
 * @param {String} toolName - The name of the tool
 * @returns {Object} - Summary statistics
 */
export const calculateToolStats = (data, toolName) => {
  const toolData = data.filter(row => row.tool_name === toolName);
  
  return {
    name: toolName,
    count: toolData.length,
    avgDuration: _.meanBy(toolData, 'duration'),
    errorRate: _.filter(toolData, 'has_error').length / toolData.length,
    avgTokens: _.meanBy(toolData, 'token_count'),
    stepDistribution: _.countBy(toolData, 'step'),
    useCases: _.uniq(toolData.map(row => row.subdir)).length,
    // Add token breakdown for visualizations
    promptTokens: _.meanBy(toolData, 'prompt_tokens') || 0,
    completionTokens: _.meanBy(toolData, 'completion_tokens') || 0
  };
};

/**
 * Get all tool summary statistics
 * @param {Array} data - The parsed CSV data
 * @returns {Array} - Array of tool statistics objects
 */
export const getAllToolStats = (data) => {
  const tools = extractUniqueTools(data);
  return tools.map(tool => calculateToolStats(data, tool));
};


/**
 * Filter data for a specific tool
 * @param {Array} data - The parsed CSV data
 * @param {String} toolName - The name of the tool
 * @returns {Array} - Filtered data for the specified tool
 */
export const getToolData = (data, toolName) => {
  return data.filter(row => row.tool_name === toolName);
};

/**
 * Prepare data for error count vs time step line chart
 * @param {Array} data - The parsed CSV data
 * @returns {Array} - Processed data for the line chart
 */
export const prepareErrorByStepData = (data) => {
  const tools = extractUniqueTools(data);
  const maxStep = _.max(data.map(d => d.step)) || 10;
  
  // Initialize the result structure with all steps
  const result = _.range(1, maxStep + 1).map(step => {
    const stepObj = { step };
    tools.forEach(tool => {
      stepObj[tool] = 0;
    });
    return stepObj;
  });
  
  // Count errors by tool and step
  data.forEach(row => {
    if (row.has_error && row.step && row.tool_name) {
      const stepIndex = row.step - 1;
      if (stepIndex >= 0 && stepIndex < result.length) {
        result[stepIndex][row.tool_name] = (result[stepIndex][row.tool_name] || 0) + 1;
      }
    }
  });
  
  return result;
};

/**
 * Prepare data for duration vs token count scatter plot
 * @param {Array} data - The parsed CSV data
 * @returns {Array} - Processed data for the scatter plot
 */
export const prepareDurationVsTokenData = (data) => {
  return data.map(row => ({
    tool: row.tool_name,
    duration: row.duration,
    tokenCount: row.token_count,
    step: row.step,
    hasError: row.has_error,
    useCase: row.subdir
  })).filter(item => 
    item.duration !== undefined && 
    item.tokenCount !== undefined && 
    item.tool !== undefined
  );
};

/**
 * Prepare data for runtime distribution (success vs error)
 * @param {Array} data - The parsed CSV data
 * @returns {Object} - Processed data for box plots or histograms
 */
export const prepareRuntimeDistributionData = (data) => {
  const tools = extractUniqueTools(data);
  
  return tools.map(tool => {
    const toolData = data.filter(row => row.tool_name === tool);
    const successRuntimes = toolData
      .filter(row => !row.has_error)
      .map(row => row.duration);
    
    const errorRuntimes = toolData
      .filter(row => row.has_error)
      .map(row => row.duration);
    
    return {
      tool,
      success: {
        runtimes: successRuntimes,
        count: successRuntimes.length,
        avg: _.mean(successRuntimes) || 0,
        min: _.min(successRuntimes) || 0,
        max: _.max(successRuntimes) || 0,
      },
      error: {
        runtimes: errorRuntimes,
        count: errorRuntimes.length,
        avg: _.mean(errorRuntimes) || 0,
        min: _.min(errorRuntimes) || 0,
        max: _.max(errorRuntimes) || 0,
      }
    };
  });
};

/**
 * Prepare data for Sankey chart (tool transitions) with error information
 * @param {Array} data - The parsed CSV data
 * @param {Object} existingColorMap - Optional color map to ensure consistency
 * @param {String} viewMode - View mode: "all" or "errors"
 * @returns {Object} - Processed data for Sankey diagram
 */
export const prepareSankeyData = (data, existingColorMap = null, viewMode = "all") => {
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

  // Assign colors to tools
  let toolColors;
  
  if (existingColorMap) {
    // Use the provided color map for consistency
    toolColors = existingColorMap;
  } else {
    // Use default colors if no color map is provided
    const colors = [
      "#e6194B", "#3cb44b", "#ffe119", "#4363d8", "#f58231",
      "#911eb4", "#42d4f4", "#f032e6", "#bfef45", "#fabebe",
      "#469990", "#dcbeff", "#9A6324", "#800000", "#aaffc3",
      "#808000", "#ffd8b1", "#000075", "#a9a9a9", "#000000"
    ];
    
    const toolList = Array.from(toolSet).sort();
    toolColors = {};
    toolList.forEach((tool, i) => {
      toolColors[tool] = colors[i % colors.length];
    });
  }

  const nodeX = nodes.map(n => n.x);

  return {
    nodes,
    links,
    toolColors,
    stepCount: Math.max(...nodes.map(n => n.step || 0), 1),
    nodeX,
    viewMode
  };
};



/**
 * Prepare tool performance metrics for visualization
 * @param {Array} data - The parsed CSV data
 * @param {String} toolName - The name of the tool (optional)
 * @returns {Object} - Various metrics for the specified tool or all tools
 */
export const prepareToolMetrics = (data, toolName = null) => {
  const filteredData = toolName 
    ? data.filter(row => row.tool_name === toolName)
    : data;

  const byStep = _.groupBy(filteredData, 'step');
  const stepMetrics = {};
  
  Object.entries(byStep).forEach(([step, rows]) => {
    const toolCounts = _.countBy(rows, 'tool_name');
    const totalCount = rows.length;
    const avgDuration = _.meanBy(rows, 'duration');
    const errorCount = _.filter(rows, 'has_error').length;
    
    stepMetrics[step] = {
      toolDistribution: Object.entries(toolCounts).map(([tool, count]) => ({
        tool,
        count,
        percentage: (count / totalCount) * 100
      })),
      avgDuration,
      errorRate: errorCount / totalCount,
      avgTokens: _.meanBy(rows, 'token_count'),
      avgTimePerToken: _.meanBy(rows, row => {
        return row.duration / (row.token_count || 1);  // Avoid division by zero
      })
    };
  });
  
  return {
    stepMetrics,
    overallErrorRate: _.filter(filteredData, 'has_error').length / filteredData.length,
    avgDuration: _.meanBy(filteredData, 'duration'),
    avgTokens: _.meanBy(filteredData, 'token_count'),
    tokenDistribution: {
      completion: _.meanBy(filteredData, 'completion_tokens'),
      prompt: _.meanBy(filteredData, 'prompt_tokens'),
      cached_tokens_pct: _.meanBy(filteredData, 'cached_tokens_pct')
    }
  };
};

/**
 * Prepare data for token metrics visualization
 * @param {Array} data - The parsed CSV data
 * @returns {Array} - Processed data for token metrics
 */
export const prepareTokenMetrics = (data) => {
  const tools = extractUniqueTools(data);
  
  return tools.map(tool => {
    const toolData = data.filter(row => row.tool_name === tool);
    
    return {
      tool,
      avgDuration: _.meanBy(toolData, 'duration') || 0,
      promptTokens: _.meanBy(toolData, 'prompt_tokens') || 0,
      completionTokens: _.meanBy(toolData, 'completion_tokens') || 0,
      totalTokens: _.meanBy(toolData, 'total_tokens') || 0,
      cachedTokensPct: _.meanBy(toolData, 'cached_tokens_pct') || 0,
      cachedTokens: _.meanBy(toolData, row => 
        (row.total_tokens || 0) * (row.cached_tokens_pct || 0)
      ) || 0
    };
  });
};


/**
 * Calculate simple token metrics for each tool
 * @param {Array} data - The parsed CSV data
 * @returns {Array} Array of token metrics objects by tool
 */
export const calculateSimpleTokenMetrics = (data) => {
  const tools = extractUniqueTools(data);
  
  return tools.map(tool => {
    // Get data for this tool
    const toolData = data.filter(row => row.tool_name === tool);
    
    if (toolData.length === 0) {
      return { tool, prompt: 0, completion: 0, total: 0 };
    }
    
    // Calculate averages with safe fallbacks
    const avgPrompt = toolData.reduce((sum, row) => sum + (Number(row.prompt_tokens) || 0), 0) / toolData.length;
    const avgCompletion = toolData.reduce((sum, row) => sum + (Number(row.completion_tokens) || 0), 0) / toolData.length;
    const avgTotal = toolData.reduce((sum, row) => sum + (Number(row.token_count) || 0), 0) / toolData.length;
    
    return {
      tool,
      prompt: Math.round(avgPrompt),
      completion: Math.round(avgCompletion),
      total: Math.round(avgTotal)
    };
  });
};

/**
 * Calculate simple duration metrics for each tool
 * @param {Array} data - The parsed CSV data
 * @returns {Array} Array of duration metrics objects by tool
 */
export const calculateSimpleDurationMetrics = (data) => {
  const tools = extractUniqueTools(data);
  
  return tools.map(tool => {
    // Get data for this tool
    const toolData = data.filter(row => row.tool_name === tool);
    
    if (toolData.length === 0) {
      return { tool, duration: 0 };
    }
    
    // Calculate average duration with safe fallback
    const avgDuration = toolData.reduce((sum, row) => sum + (Number(row.duration) || 0), 0) / toolData.length;
    
    return {
      tool,
      duration: parseFloat(avgDuration.toFixed(2))
    };
  });
};