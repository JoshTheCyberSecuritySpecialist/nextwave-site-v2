import { ArrowRight } from 'lucide-react';

interface DiagramNode {
  label: string;
  sublabel?: string;
}

interface ArchitectureDiagramProps {
  nodes: DiagramNode[];
  title?: string;
}

export const ArchitectureDiagram = ({ nodes, title }: ArchitectureDiagramProps) => {
  return (
    <div className="space-y-3">
      {title && (
        <h5 className="text-xs uppercase tracking-wider text-gray-400 font-semibold">
          {title}
        </h5>
      )}
      <div className="flex flex-col gap-2">
        {nodes.map((node, index) => (
          <div key={index} className="flex items-center gap-2">
            <div className="flex-grow">
              <div className="px-3 py-2 bg-gray-800/40 border border-gray-700/50 rounded text-center">
                <div className="text-xs font-medium text-white">{node.label}</div>
                {node.sublabel && (
                  <div className="text-[10px] text-gray-400 mt-0.5">{node.sublabel}</div>
                )}
              </div>
            </div>
            {index < nodes.length - 1 && (
              <ArrowRight size={14} className="text-[#2283B8] flex-shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
