import { motion } from 'framer-motion';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface SystemPortfolioCardProps {
  projectName: string;
  systemType: string;
  industry: string;
  icon: React.ReactNode;
  techStack: string[];
  overview: string;
  capabilities: string[];
  classification: string[];
  architectureDiagram?: React.ReactNode;
  delay?: number;
  isEnterprise?: boolean;
  enterpriseFocus?: string[];
  deploymentModel?: string;
  enterpriseSystemType?: string;
  technicalArchitecture?: {
    overview: string;
    diagramPath?: string;
    diagramCaption?: string;
    enabledFeatures: string[];
    designNotes: string[];
    classificationFooter?: string;
  };
}

export const SystemPortfolioCard = ({
  projectName,
  systemType,
  industry,
  icon,
  techStack,
  overview,
  capabilities,
  classification,
  architectureDiagram,
  delay = 0,
  isEnterprise = false,
  enterpriseFocus,
  deploymentModel,
  enterpriseSystemType,
  technicalArchitecture,
}: SystemPortfolioCardProps) => {
  const [showArchitecture, setShowArchitecture] = useState(isEnterprise && technicalArchitecture ? true : false);
  const [showTechnicalArchitecture, setShowTechnicalArchitecture] = useState(isEnterprise && technicalArchitecture ? true : false);

  const displaySystemType = isEnterprise && enterpriseSystemType ? enterpriseSystemType : systemType;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5 }}
      className="relative group"
    >
      <div className="relative h-full flex flex-col bg-white/5 backdrop-blur-sm border border-gray-700/50 rounded-lg hover:border-[#2283B8]/50 transition-all duration-300 hover:shadow-lg hover:shadow-[#2283B8]/10 hover:-translate-y-1">
        <div className="p-6 flex flex-col flex-grow">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-grow">
              <div className="flex items-center gap-3 mb-2">
                <div className="text-gray-400">{icon}</div>
                <div>
                  <h3 className="text-xl font-bold text-white">{projectName}</h3>
                  <p className="text-xs uppercase tracking-wider text-gray-400 font-medium">
                    {displaySystemType} • {industry}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {techStack.map((tech, index) => (
              <span
                key={index}
                className="px-2.5 py-1 text-xs font-medium bg-gray-800/60 text-gray-300 rounded border border-gray-700/50"
              >
                {tech}
              </span>
            ))}
          </div>

          <p className="text-sm text-gray-300 leading-relaxed mb-4">
            {overview}
          </p>

          {isEnterprise && enterpriseFocus ? (
            <div className="mb-4">
              <h4 className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2">
                Enterprise Focus Areas
              </h4>
              <div className="grid grid-cols-1 gap-1.5">
                {enterpriseFocus.map((focus, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="text-[#2283B8] text-xs mt-0.5">▪</span>
                    <span className="text-xs text-gray-300">{focus}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mb-4">
              <h4 className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2">
                Capabilities
              </h4>
              <div className="grid grid-cols-2 gap-1.5">
                {capabilities.map((capability, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="text-[#2283B8] text-xs mt-0.5">✓</span>
                    <span className="text-xs text-gray-300">{capability}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-auto pt-4 border-t border-gray-700/50">
            <div className="flex flex-wrap gap-2 text-xs text-gray-400">
              {classification.map((item, index) => (
                <span key={index} className="flex items-center gap-1">
                  {item}
                  {index < classification.length - 1 && (
                    <span className="text-gray-600">•</span>
                  )}
                </span>
              ))}
            </div>
            {isEnterprise && deploymentModel && (
              <div className="mt-2 text-xs text-gray-500">
                <span className="font-medium">Deployment:</span> {deploymentModel}
              </div>
            )}
          </div>
        </div>

        {technicalArchitecture ? (
          <div className="border-t border-gray-700/50">
            <button
              onClick={() => setShowTechnicalArchitecture(!showTechnicalArchitecture)}
              className="w-full px-6 py-3 flex items-center justify-between text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
            >
              <span>View Technical Architecture</span>
              {showTechnicalArchitecture ? (
                <ChevronUp size={16} />
              ) : (
                <ChevronDown size={16} />
              )}
            </button>
            {showTechnicalArchitecture && (
              <div className="px-6 py-6 bg-black/20 border-t border-gray-700/50">
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-semibold text-white mb-2">
                      Technical Architecture Overview
                    </h4>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      {technicalArchitecture.overview}
                    </p>
                  </div>

                  {technicalArchitecture.diagramPath && (
                    <div className="space-y-2">
                      <div className="bg-white/5 border border-gray-700/30 rounded-lg p-4 flex items-center justify-center">
                        <img
                          src={technicalArchitecture.diagramPath}
                          alt="Architecture Diagram"
                          className="max-w-full h-auto rounded"
                        />
                      </div>
                      {technicalArchitecture.diagramCaption && (
                        <p className="text-xs text-gray-400 text-center italic">
                          {technicalArchitecture.diagramCaption}
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <h4 className="text-sm font-semibold text-white mb-3">
                      What This Architecture Enables
                    </h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      {technicalArchitecture.enabledFeatures.map((feature, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <span className="text-[#2283B8] text-xs mt-0.5">✓</span>
                          <span className="text-xs text-gray-300">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-white mb-2">
                      System Design Notes
                    </h4>
                    <div className="space-y-1.5">
                      {technicalArchitecture.designNotes.map((note, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <span className="text-[#2283B8] text-xs mt-0.5">▪</span>
                          <span className="text-xs text-gray-300">{note}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {technicalArchitecture.classificationFooter && (
                    <div className="pt-3 border-t border-gray-700/30">
                      <p className="text-xs text-gray-500 text-center">
                        {technicalArchitecture.classificationFooter}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : architectureDiagram ? (
          <div className="border-t border-gray-700/50">
            <button
              onClick={() => setShowArchitecture(!showArchitecture)}
              className="w-full px-6 py-3 flex items-center justify-between text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
            >
              <span>System Architecture</span>
              {showArchitecture ? (
                <ChevronUp size={16} />
              ) : (
                <ChevronDown size={16} />
              )}
            </button>
            {showArchitecture && (
              <div className="px-6 py-4 bg-black/20 border-t border-gray-700/50">
                {architectureDiagram}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
};
