import React, { useState } from 'react';
import { Brain, Sparkles, ListChecks, ArrowRight, Trash2, Plus, CheckCircle2 } from 'lucide-react';

export default function GTDCoach() {
  const [stage, setStage] = useState('mindsweep'); // mindsweep, process, prioritize
  const [mindsweepItems, setMindsweepItems] = useState([]);
  const [currentInput, setCurrentInput] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [processedItems, setProcessedItems] = useState([]);
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingFeedback, setProcessingFeedback] = useState('');
  const [prioritizedItems, setPrioritizedItems] = useState([]);
  const [isPrioritizing, setIsPrioritizing] = useState(false);

  // Mindsweep Stage
  const addMindsweepItem = () => {
    if (currentInput.trim()) {
      setMindsweepItems([...mindsweepItems, currentInput.trim()]);
      setCurrentInput('');
    }
  };

  const addBulkItems = () => {
    if (bulkInput.trim()) {
      const items = bulkInput
        .split('\n')
        .map(item => item.trim())
        .filter(item => item.length > 0);
      setMindsweepItems([...mindsweepItems, ...items]);
      setBulkInput('');
      setIsBulkMode(false);
    }
  };

  const removeMindsweepItem = (index) => {
    setMindsweepItems(mindsweepItems.filter((_, i) => i !== index));
  };

  const startProcessing = () => {
    if (mindsweepItems.length === 0) return;
    setStage('process');
    setCurrentProcessingIndex(0);
  };

  // Processing Stage
  const processNextAction = async () => {
    if (currentProcessingIndex >= mindsweepItems.length) {
      setStage('prioritize');
      return;
    }

    setIsProcessing(true);
    setProcessingFeedback('Analyzing and refining...');

    const item = mindsweepItems[currentProcessingIndex];

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          messages: [
            {
              role: "user",
              content: `You are a GTD (Getting Things Done) coach. A user has captured this item during their mindsweep:

"${item}"

Analyze this item according to GTD principles:

**PROJECT**: A multi-step outcome that requires more than one action to complete. Projects MUST have a clear outcome and a concrete next action.

**NEXT ACTION**: A single, physical, visible action that can be done in one sitting. Must start with an action verb and be completely clear about what to do.

**REFERENCE**: Information to store for later (no action needed).

**SOMEDAY/MAYBE**: Something you might want to do in the future but not now.

Rules:
- If it requires multiple steps → It's a PROJECT. Define the outcome and identify the FIRST next action.
- If it's a single completable action → It's a NEXT ACTION.
- A quality next action must: start with a verb, be specific, be completable in one sitting, include context.
- Projects should be stated as outcomes (e.g., "Website redesign complete" not "Redesign website").

Respond with a JSON object in this exact format (DO NOT include any other text or markdown):
{
  "isActionable": true/false,
  "category": "next-action/project/reference/someday",
  "projectOutcome": "the desired outcome (only if project)",
  "nextAction": "the specific next action to take",
  "reasoning": "brief explanation of your analysis",
  "futureActions": ["array of other actions that will be needed (only if project)"]
}

Examples:
- "plan vacation" → PROJECT: "Summer vacation planned", next action: "Email Sarah to discuss vacation dates"
- "call dentist" → NEXT ACTION: "Call Dr. Smith's office at 555-0123 to schedule cleaning"
- "recipe for lasagna" → REFERENCE: Store in recipe collection`
            }
          ]
        })
      });

      const data = await response.json();
      let responseText = data.content[0].text;
      
      // Strip markdown code blocks if present
      responseText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      
      const result = JSON.parse(responseText);

      setProcessedItems([...processedItems, {
        original: item,
        ...result
      }]);

      setProcessingFeedback('');
      setCurrentProcessingIndex(currentProcessingIndex + 1);
    } catch (error) {
      console.error("Error processing item:", error);
      setProcessingFeedback('Error processing item. Adding as-is and moving to next.');
      setProcessedItems([...processedItems, {
        original: item,
        isActionable: true,
        category: 'next-action',
        nextAction: item,
        reasoning: 'Could not process automatically'
      }]);
      setCurrentProcessingIndex(currentProcessingIndex + 1);
    } finally {
      setIsProcessing(false);
    }
  };

  const skipCurrentItem = () => {
    setProcessedItems([...processedItems, {
      original: mindsweepItems[currentProcessingIndex],
      isActionable: true,
      category: 'next-action',
      nextAction: mindsweepItems[currentProcessingIndex],
      reasoning: 'Skipped processing'
    }]);
    setCurrentProcessingIndex(currentProcessingIndex + 1);
  };

  const editProcessedAction = (index, newNextAction) => {
    const updated = [...processedItems];
    updated[index].nextAction = newNextAction;
    setProcessedItems(updated);
  };

  // Prioritization Stage
  const prioritizeActions = async () => {
    // Get all actionable items (both standalone next actions and project next actions)
    const actionableItems = processedItems.filter(item => 
      item.isActionable && (item.category === 'next-action' || item.category === 'project')
    );

    if (actionableItems.length === 0) {
      setPrioritizedItems([]);
      return;
    }

    setIsPrioritizing(true);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 3000,
          messages: [
            {
              role: "user",
              content: `You are a GTD coach helping someone prioritize their next actions. Here are their actionable items (some are standalone actions, others are first actions for projects):

${actionableItems.map((item, i) => {
  if (item.category === 'project') {
    return `${i + 1}. [PROJECT: ${item.projectOutcome}] ${item.nextAction}`;
  }
  return `${i + 1}. ${item.nextAction}`;
}).join('\n')}

Analyze these next actions and provide prioritization guidance using the Eisenhower Matrix (Urgent/Important). Consider both the immediate action and the project context where applicable.

Respond with a JSON object in this exact format (DO NOT include any other text or markdown):

{
  "prioritizedActions": [
    {
      "action": "the action text",
      "priority": "urgent-important/important-not-urgent/urgent-not-important/neither",
      "rationale": "brief explanation",
      "suggestedOrder": 1
    }
  ],
  "overallGuidance": "2-3 sentences of coaching on what to focus on first"
}

Sort by suggestedOrder (1 being highest priority).`
            }
          ]
        })
      });

      const data = await response.json();
      let responseText = data.content[0].text;
      responseText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      
      const result = JSON.parse(responseText);
      
      // Attach the original item data to prioritized actions
      result.prioritizedActions = result.prioritizedActions.map(prioritizedAction => {
        const originalItem = actionableItems.find(item => 
          item.nextAction === prioritizedAction.action || 
          prioritizedAction.action.includes(item.nextAction)
        );
        return {
          ...prioritizedAction,
          isProject: originalItem?.category === 'project',
          projectOutcome: originalItem?.projectOutcome
        };
      });
      
      setPrioritizedItems(result);
    } catch (error) {
      console.error("Error prioritizing:", error);
      setPrioritizedItems({
        prioritizedActions: actionableItems.map((item, i) => ({
          action: item.nextAction,
          priority: 'neither',
          rationale: 'Auto-prioritization unavailable',
          suggestedOrder: i + 1,
          isProject: item.category === 'project',
          projectOutcome: item.projectOutcome
        })),
        overallGuidance: 'Review your actions and choose what feels most important right now.'
      });
    } finally {
      setIsPrioritizing(false);
    }
  };

  React.useEffect(() => {
    if (stage === 'prioritize' && prioritizedItems.length === 0 && !isPrioritizing) {
      prioritizeActions();
    }
  }, [stage]);

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent-important': return 'bg-red-100 border-red-300 text-red-800';
      case 'important-not-urgent': return 'bg-blue-100 border-blue-300 text-blue-800';
      case 'urgent-not-important': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      default: return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const getPriorityLabel = (priority) => {
    switch (priority) {
      case 'urgent-important': return 'DO FIRST';
      case 'important-not-urgent': return 'SCHEDULE';
      case 'urgent-not-important': return 'DELEGATE';
      default: return 'ELIMINATE/DEFER';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">GTD Coach</h1>
          <p className="text-gray-600">Your personal Getting Things Done assistant</p>
        </div>

        {/* Progress Indicator */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-2 ${stage === 'mindsweep' ? 'text-indigo-600 font-semibold' : 'text-gray-400'}`}>
              <Brain size={24} />
              <span>Mindsweep</span>
            </div>
            <ArrowRight className="text-gray-300" size={20} />
            <div className={`flex items-center gap-2 ${stage === 'process' ? 'text-indigo-600 font-semibold' : 'text-gray-400'}`}>
              <Sparkles size={24} />
              <span>Process</span>
            </div>
            <ArrowRight className="text-gray-300" size={20} />
            <div className={`flex items-center gap-2 ${stage === 'prioritize' ? 'text-indigo-600 font-semibold' : 'text-gray-400'}`}>
              <ListChecks size={24} />
              <span>Prioritize</span>
            </div>
          </div>
        </div>

        {/* Mindsweep Stage */}
        {stage === 'mindsweep' && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Brain className="text-indigo-600" />
              Mindsweep: Capture Everything
            </h2>
            <p className="text-gray-600 mb-6">
              Write down everything on your mind. Don't filter or organize yet—just capture!
            </p>

            {/* Toggle between single and bulk mode */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setIsBulkMode(false)}
                className={`px-4 py-2 rounded-lg transition ${
                  !isBulkMode 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Single Item
              </button>
              <button
                onClick={() => setIsBulkMode(true)}
                className={`px-4 py-2 rounded-lg transition ${
                  isBulkMode 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Bulk Input
              </button>
            </div>

            {/* Single item input */}
            {!isBulkMode && (
              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addMindsweepItem()}
                  placeholder="What's on your mind? (e.g., 'call dentist', 'plan vacation', 'fix kitchen sink')"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={addMindsweepItem}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
                >
                  <Plus size={20} />
                  Add
                </button>
              </div>
            )}

            {/* Bulk input */}
            {isBulkMode && (
              <div className="mb-6">
                <textarea
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  placeholder="Paste your list here, one item per line:&#10;&#10;Call dentist&#10;Plan vacation&#10;Fix kitchen sink&#10;Review quarterly report&#10;Buy groceries"
                  rows={10}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                />
                <button
                  onClick={addBulkItems}
                  className="mt-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
                >
                  <Plus size={20} />
                  Add All Items
                </button>
              </div>
            )}

            <div className="space-y-2 mb-6">
              {mindsweepItems.map((item, index) => (
                <div key={index} className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg">
                  <span className="flex-1 text-gray-700">{item}</span>
                  <button
                    onClick={() => removeMindsweepItem(index)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded transition"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>

            {mindsweepItems.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <Brain size={48} className="mx-auto mb-2 opacity-50" />
                <p>Start your mindsweep by adding items above</p>
              </div>
            )}

            {mindsweepItems.length > 0 && (
              <div className="flex justify-between items-center pt-4 border-t">
                <span className="text-gray-600">{mindsweepItems.length} items captured</span>
                <button
                  onClick={startProcessing}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
                >
                  Start Processing
                  <ArrowRight size={20} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Processing Stage */}
        {stage === 'process' && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Sparkles className="text-indigo-600" />
              Process: Create Quality Next Actions
            </h2>
            
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-indigo-900 font-medium mb-2">GTD Processing Principles:</p>
              <ul className="text-sm text-indigo-800 space-y-1">
                <li><strong>Next Action:</strong> Single, specific action you can do now</li>
                <li><strong>Project:</strong> Multi-step outcome requiring 2+ actions (includes next action)</li>
                <li><strong>Reference:</strong> Info to keep, no action needed</li>
                <li><strong>Someday/Maybe:</strong> Ideas for later consideration</li>
              </ul>
            </div>
            
            <div className="mb-6">
              <div className="bg-gray-100 rounded-lg p-4 mb-4">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Progress</span>
                  <span>{currentProcessingIndex} of {mindsweepItems.length}</span>
                </div>
                <div className="w-full bg-gray-300 rounded-full h-2">
                  <div 
                    className="bg-indigo-600 h-2 rounded-full transition-all"
                    style={{ width: `${(currentProcessingIndex / mindsweepItems.length) * 100}%` }}
                  />
                </div>
              </div>

              {currentProcessingIndex < mindsweepItems.length ? (
                <div>
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-gray-600 mb-1">Current item:</p>
                    <p className="text-lg font-medium text-gray-800">{mindsweepItems[currentProcessingIndex]}</p>
                  </div>

                  {processingFeedback && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-blue-800">
                      {processingFeedback}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={processNextAction}
                      disabled={isProcessing}
                      className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Sparkles size={20} />
                      {isProcessing ? 'Processing...' : 'Refine with AI'}
                    </button>
                    <button
                      onClick={skipCurrentItem}
                      disabled={isProcessing}
                      className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition disabled:bg-gray-100"
                    >
                      Keep As-Is
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle2 size={48} className="mx-auto mb-2 text-green-500" />
                  <p className="text-lg font-medium text-gray-800 mb-4">Processing complete!</p>
                  <button
                    onClick={() => setStage('prioritize')}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-2 mx-auto"
                  >
                    Continue to Prioritization
                    <ArrowRight size={20} />
                  </button>
                </div>
              )}
            </div>

            {processedItems.length > 0 && (
              <div className="pt-6 border-t">
                <h3 className="font-semibold text-gray-800 mb-3">Processed Items ({processedItems.length})</h3>
                <div className="space-y-3">
                  {processedItems.map((item, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-start gap-3 mb-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          item.category === 'next-action' ? 'bg-green-100 text-green-800' :
                          item.category === 'project' ? 'bg-blue-100 text-blue-800' :
                          item.category === 'reference' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {item.category === 'next-action' ? 'Next Action' : 
                           item.category === 'project' ? 'Project' :
                           item.category === 'reference' ? 'Reference' : 'Someday/Maybe'}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-500 mb-2">Original: <span className="italic">{item.original}</span></p>
                      
                      {item.category === 'project' && item.projectOutcome && (
                        <div className="mb-3 bg-blue-50 border border-blue-200 rounded p-3">
                          <p className="text-xs text-blue-600 font-medium mb-1">PROJECT OUTCOME:</p>
                          <input
                            type="text"
                            value={item.projectOutcome}
                            onChange={(e) => {
                              const updated = [...processedItems];
                              updated[index].projectOutcome = e.target.value;
                              setProcessedItems(updated);
                            }}
                            className="w-full px-3 py-2 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-blue-900 bg-white"
                          />
                        </div>
                      )}
                      
                      <div className="mb-2">
                        <p className="text-xs text-gray-600 font-medium mb-1">
                          {item.category === 'project' ? 'NEXT ACTION:' : 'ACTION:'}
                        </p>
                        <input
                          type="text"
                          value={item.nextAction}
                          onChange={(e) => editProcessedAction(index, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                        />
                      </div>
                      
                      <p className="text-xs text-gray-500 italic mb-2">{item.reasoning}</p>
                      
                      {item.futureActions && item.futureActions.length > 0 && (
                        <div className="mt-3 bg-gray-100 rounded p-3">
                          <p className="text-xs text-gray-700 font-medium mb-1">Future actions for this project:</p>
                          <ul className="text-xs text-gray-600 space-y-1">
                            {item.futureActions.map((action, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-gray-400 mt-0.5">•</span>
                                <span>{action}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Prioritization Stage */}
        {stage === 'prioritize' && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <ListChecks className="text-indigo-600" />
              Prioritize: Focus on What Matters
            </h2>

            {isPrioritizing ? (
              <div className="text-center py-8">
                <Sparkles size={48} className="mx-auto mb-2 text-indigo-600 animate-pulse" />
                <p className="text-gray-600">Analyzing priorities...</p>
              </div>
            ) : prioritizedItems.prioritizedActions ? (
              <div>
                {prioritizedItems.overallGuidance && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
                    <p className="text-sm font-medium text-indigo-900 mb-1">Coaching Guidance:</p>
                    <p className="text-indigo-800">{prioritizedItems.overallGuidance}</p>
                  </div>
                )}

                <div className="space-y-3">
                  {prioritizedItems.prioritizedActions.map((item, index) => (
                    <div key={index} className={`border-2 rounded-lg p-4 ${getPriorityColor(item.priority)}`}>
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-xs font-bold px-2 py-1 rounded bg-white bg-opacity-50">
                          #{item.suggestedOrder} - {getPriorityLabel(item.priority)}
                        </span>
                      </div>
                      {item.isProject && item.projectOutcome && (
                        <div className="mb-2 pb-2 border-b border-current opacity-75">
                          <p className="text-xs font-medium">PROJECT: {item.projectOutcome}</p>
                        </div>
                      )}
                      <p className="font-medium text-lg mb-2">{item.action}</p>
                      <p className="text-sm opacity-90 italic">{item.rationale}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-6 border-t">
                  <h3 className="font-semibold text-gray-800 mb-3">Other Items</h3>
                  <div className="space-y-2">
                    {processedItems.filter(item => !item.isActionable || (item.category !== 'next-action' && item.category !== 'project')).length > 0 ? (
                      processedItems.filter(item => !item.isActionable || (item.category !== 'next-action' && item.category !== 'project')).map((item, index) => (
                        <div key={index} className="bg-gray-50 rounded-lg p-3">
                          <span className={`text-xs px-2 py-1 rounded font-medium ${
                            item.category === 'reference' ? 'bg-purple-100 text-purple-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {item.category === 'reference' ? 'Reference' : 'Someday/Maybe'}
                          </span>
                          <p className="text-gray-700 mt-2">{item.nextAction || item.original}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-sm italic">No reference or someday/maybe items</p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setStage('mindsweep');
                    setMindsweepItems([]);
                    setProcessedItems([]);
                    setPrioritizedItems([]);
                    setCurrentProcessingIndex(0);
                  }}
                  className="w-full mt-6 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                  Start New Mindsweep
                </button>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No actionable items to prioritize.</p>
                <button
                  onClick={() => {
                    setStage('mindsweep');
                    setMindsweepItems([]);
                    setProcessedItems([]);
                    setPrioritizedItems([]);
                    setCurrentProcessingIndex(0);
                  }}
                  className="mt-4 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                  Start Over
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}