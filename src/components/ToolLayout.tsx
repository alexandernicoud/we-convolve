import { ReactNode, useState } from "react";
import { ChevronDown } from "lucide-react";

interface ToolLayoutProps {
  title: string;
  description: string;
  inputPanel: ReactNode;
  outputPanel: ReactNode;
  advancedPanel?: ReactNode;
}

export default function ToolLayout({ 
  title, 
  description, 
  inputPanel, 
  outputPanel,
  advancedPanel 
}: ToolLayoutProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="container-wide">
        {/* Header */}
        <div className="mb-12 opacity-0 animate-fade-up">
          <h1 className="text-3xl md:text-4xl font-semibold text-[#F5F7FF] mb-3">
            {title}
          </h1>
          <p className="text-[#F5F7FF]/62 text-lg max-w-2xl">
            {description}
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          {/* Input Panel */}
          <div className="bg-[#070815]/60 backdrop-blur-sm border border-white/8 rounded-xl p-6 opacity-0 animate-fade-up" style={{ animationDelay: '100ms' }}>
            <h2 className="text-lg font-medium text-[#F5F7FF] mb-6 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#7C5CFF]" />
              Configuration
            </h2>
            {inputPanel}
          </div>

          {/* Output Panel */}
          <div className="bg-[#070815]/60 backdrop-blur-sm border border-white/8 rounded-xl p-6 opacity-0 animate-fade-up" style={{ animationDelay: '200ms' }}>
            <h2 className="text-lg font-medium text-[#F5F7FF] mb-6 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#F5F7FF]/62" />
              Output
            </h2>
            {outputPanel}
          </div>
        </div>

        {/* Advanced Panel */}
        {advancedPanel && (
          <div className="bg-[#070815]/60 backdrop-blur-sm border border-white/8 rounded-xl opacity-0 animate-fade-up" style={{ animationDelay: '300ms' }}>
            <button
              onClick={() => setAdvancedOpen(!advancedOpen)}
              className="w-full p-6 flex items-center justify-between text-left hover:bg-[#7C5CFF]/8 transition-colors rounded-xl"
            >
              <h2 className="text-lg font-medium text-[#F5F7FF]">
                Advanced Insights
              </h2>
              <ChevronDown className={`w-5 h-5 text-[#F5F7FF]/62 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
            </button>

            {advancedOpen && (
              <div className="p-6 pt-0 border-t border-white/8 animate-fade-in">
                {advancedPanel}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
