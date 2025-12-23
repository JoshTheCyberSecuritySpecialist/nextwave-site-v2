import { motion } from 'framer-motion';
import { useState } from 'react';
import { Globe, Shield, Briefcase, Calendar, Users, Wallet } from 'lucide-react';
import { SystemPortfolioCard } from '../components/SystemPortfolioCard';
import { ArchitectureDiagram } from '../components/ArchitectureDiagram';

interface PortfolioProps {
  onNavigate: (page: string) => void;
}

export const Portfolio = ({ onNavigate }: PortfolioProps) => {
  const [viewMode, setViewMode] = useState<'standard' | 'enterprise'>('standard');

  const projects = [
    {
      projectName: 'NexDay Plumbing',
      systemType: 'Service Operations Platform',
      industry: 'Field Services',
      icon: <Globe size={20} />,
      techStack: ['React', 'Node.js', 'Express', 'Form Automation', 'SEO Schema'],
      overview: 'Lead intake and scheduling platform designed to convert inbound service traffic into qualified, bookable requests.',
      capabilities: [
        'Conditional service request workflows',
        'Automated booking and lead routing',
        'Mobile-first emergency service UX',
        'Local SEO schema optimization',
        'Conversion analytics instrumentation',
        'Performance monitoring',
      ],
      classification: ['Client Deployment', 'Production System'],
      architectureDiagram: (
        <ArchitectureDiagram
          nodes={[
            { label: 'User', sublabel: 'Web Browser' },
            { label: 'React Frontend', sublabel: 'Service Forms' },
            { label: 'Node.js API', sublabel: 'Booking Logic' },
            { label: 'Email / CRM', sublabel: 'Notifications' },
          ]}
        />
      ),
      enterpriseFocus: [
        'Authentication & access control',
        'Data validation & handling',
        'Auditability & reporting',
        'Automation & policy enforcement',
        'Scalability considerations',
      ],
      deploymentModel: 'Client-managed environments',
      showInEnterprise: true,
    },
    {
      projectName: 'TreeTek Florida',
      systemType: 'Field Services Intake System',
      industry: 'Hazardous Field Services',
      icon: <Globe size={20} />,
      techStack: ['React', 'Secure Uploads', 'Image Optimization', 'CRM Handoff'],
      overview: 'Visual-first intake system engineered to qualify hazardous field service requests before dispatch.',
      capabilities: [
        'Customer image and document uploads',
        'Structured estimate request workflows',
        'Gallery-driven trust validation',
        'Lead qualification logic',
        'Mobile-optimized submissions',
        'Secure file handling',
      ],
      classification: ['Client Deployment', 'Production System'],
      architectureDiagram: (
        <ArchitectureDiagram
          nodes={[
            { label: 'User', sublabel: 'Mobile/Desktop' },
            { label: 'React Frontend', sublabel: 'Secure Uploads' },
            { label: 'Image Optimization', sublabel: 'Processing Layer' },
            { label: 'Quote Logic', sublabel: 'Business Rules' },
            { label: 'CRM / Email', sublabel: 'Dispatch' },
          ]}
        />
      ),
      enterpriseFocus: [
        'Secure file upload & validation',
        'Data handling & storage',
        'Mobile security considerations',
        'Integration auditability',
        'Performance under load',
      ],
      deploymentModel: 'Client-managed environments',
      showInEnterprise: false,
    },
    {
      projectName: 'SecureSetup 365',
      systemType: 'Microsoft 365 Security Automation',
      industry: 'Enterprise Security',
      icon: <Shield size={20} />,
      techStack: ['Microsoft 365', 'Entra ID', 'Intune', 'Security Baselines', 'Automation'],
      overview: 'Automation framework enforcing baseline security and compliance controls across Microsoft 365 environments.',
      capabilities: [
        'Identity and access baseline enforcement',
        'MFA and conditional access configuration',
        'Policy validation and drift detection',
        'Automated tenant hardening',
        'Compliance-ready reporting',
        'Continuous monitoring',
      ],
      classification: ['Internal Platform', 'Enterprise System'],
      architectureDiagram: (
        <ArchitectureDiagram
          nodes={[
            { label: 'Admin Console', sublabel: 'Control Plane' },
            { label: 'Automation Engine', sublabel: 'Policy Orchestration' },
            { label: 'Microsoft 365 APIs', sublabel: 'Integration Layer' },
            { label: 'Entra ID / Intune', sublabel: 'Policy Enforcement' },
            { label: 'Compliance Reports', sublabel: 'Audit Trail' },
          ]}
        />
      ),
      enterpriseFocus: [
        'Zero-trust security architecture',
        'Compliance & audit readiness (HIPAA, SOC 2)',
        'Policy enforcement & drift detection',
        'Automated security baseline management',
        'Enterprise-scale deployment patterns',
      ],
      deploymentModel: 'Internal tooling',
      showInEnterprise: true,
    },
    {
      projectName: 'Launch Zone Charters',
      systemType: 'Event-Driven Booking Platform',
      industry: 'Tourism & Events',
      icon: <Calendar size={20} />,
      techStack: ['Booking APIs', 'Payments', 'Calendar Sync', 'Responsive UI'],
      overview: 'Reservation platform designed for time-sensitive bookings tied to live event scheduling.',
      capabilities: [
        'Availability and capacity management',
        'Event-aware booking logic',
        'Automated confirmations and reminders',
        'Mobile checkout flow',
        'Reservation reporting',
        'Payment processing',
      ],
      classification: ['Client Deployment', 'Production System'],
      architectureDiagram: (
        <ArchitectureDiagram
          nodes={[
            { label: 'Customer', sublabel: 'Booking Interface' },
            { label: 'Booking UI', sublabel: 'Availability Engine' },
            { label: 'Calendar Sync', sublabel: 'Scheduling Logic' },
            { label: 'Payments', sublabel: 'Transaction Processing' },
            { label: 'Confirmations', sublabel: 'Notifications' },
          ]}
        />
      ),
      enterpriseFocus: [
        'Payment security & PCI considerations',
        'Transaction auditability',
        'Capacity management at scale',
        'Integration with external systems',
        'Customer data protection',
      ],
      deploymentModel: 'Client-managed environments',
      showInEnterprise: true,
    },
    {
      projectName: 'HireMate',
      systemType: 'Hiring Workflow Automation (SaaS)',
      industry: 'HR Technology',
      icon: <Users size={20} />,
      techStack: ['Node.js', 'Workflow Engine', 'APIs', 'AI Services'],
      overview: 'Internal SaaS platform automating recruiting pipelines and candidate processing.',
      capabilities: [
        'Candidate intake normalization',
        'Workflow and pipeline automation',
        'AI-assisted screening logic',
        'External API integrations',
        'Multi-tenant SaaS architecture',
        'Analytics dashboard',
      ],
      classification: ['Internal Platform', 'SaaS System'],
      architectureDiagram: (
        <ArchitectureDiagram
          nodes={[
            { label: 'Candidate Intake', sublabel: 'Application Layer' },
            { label: 'Workflow Engine', sublabel: 'Orchestration' },
            { label: 'AI Screening', sublabel: 'Processing Logic' },
            { label: 'Pipeline Manager', sublabel: 'State Management' },
            { label: 'External Integrations', sublabel: 'API Layer' },
          ]}
        />
      ),
      enterpriseFocus: [
        'Multi-tenant data isolation',
        'PII handling & data privacy',
        'API security & rate limiting',
        'Workflow auditability',
        'Scalable SaaS architecture',
      ],
      deploymentModel: 'Multi-tenant capable',
      showInEnterprise: true,
    },
    {
      projectName: 'XRPay',
      systemType: 'Digital Payments Interface',
      enterpriseSystemType: 'Ledger-Native Payments Architecture',
      industry: 'Financial Systems',
      icon: <Wallet size={20} />,
      techStack: ['React', 'XRP Ledger', 'Payment Channels', 'Cryptographic Authorization'],
      overview: 'Modular payment interface designed for high-throughput, low-latency digital transactions with ledger-backed settlement.',
      capabilities: [
        'Wallet-based payment flows',
        'Real-time transaction status',
        'Modular checkout and POS components',
        'XRP Ledger-compatible architecture',
        'Designed for scalable, low-fee transactions',
      ],
      classification: ['R&D Platform', 'Fintech Architecture', 'Ledger-Native Payments'],
      technicalArchitecture: {
        overview: 'XRPay leverages XRP Ledger Payment Channels to enable fast, off-ledger payment flows with secure on-ledger settlement and cryptographic guarantees between payer and payee.',
        diagramPath: '/image.png',
        diagramCaption: 'XRP Ledger Payment Channel lifecycle showing off-ledger payment authorization and on-ledger settlement.',
        enabledFeatures: [
          'Off-ledger microtransactions for speed',
          'On-ledger settlement for finality',
          'Cryptographic claim authorization',
          'Reduced network fees and congestion',
          'High-throughput payment support',
          'POS and recurring payment compatibility',
        ],
        designNotes: [
          'Architecture based on XRP Ledger payment channel specifications',
          'Optimized for high-frequency transaction scenarios',
          'Designed to minimize ledger writes while preserving trust guarantees',
          'Suitable for merchant payments and payment aggregation use cases',
        ],
        classificationFooter: 'R&D Platform • Fintech Architecture • Ledger-Native Payments',
      },
      enterpriseFocus: [
        'High-throughput transaction design',
        'Ledger-backed settlement guarantees',
        'Off-ledger performance optimization',
        'Cryptographic authorization workflows',
        'Designed for POS and payment infrastructure',
      ],
      deploymentModel: 'Active development',
      showInEnterprise: true,
    },
  ];

  const filteredProjects = viewMode === 'enterprise'
    ? projects.filter(p => p.showInEnterprise && (p.projectName === 'XRPay' || !p.classification.includes('R&D Platform')))
    : projects;

  return (
    <div className="pt-32 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            {viewMode === 'standard' ? 'Our Portfolio' : 'Enterprise Solutions Portfolio'}
          </h1>
          <p className="text-lg text-gray-300 max-w-3xl mx-auto mb-6">
            {viewMode === 'standard'
              ? 'Production platforms and internal systems engineered for security, automation, and scale.'
              : 'Security-focused platforms engineered for regulated and high-reliability environments.'}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-gray-400 mb-6">
            <span>Web Platforms</span>
            <span className="text-gray-600">•</span>
            <span>Automation</span>
            <span className="text-gray-600">•</span>
            <span>Security</span>
            <span className="text-gray-600">•</span>
            <span>SaaS</span>
            <span className="text-gray-600">•</span>
            <span>Payments</span>
          </div>

          <div className="w-24 h-px bg-gradient-to-r from-transparent via-[#2283B8] to-transparent mx-auto mb-8" />

          <div className="inline-flex items-center bg-gray-900/50 border border-gray-700/50 rounded-lg p-1">
            <button
              onClick={() => setViewMode('standard')}
              className={`px-6 py-2 text-sm font-medium rounded-md transition-all ${
                viewMode === 'standard'
                  ? 'bg-[#2283B8] text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Standard
            </button>
            <button
              onClick={() => setViewMode('enterprise')}
              className={`px-6 py-2 text-sm font-medium rounded-md transition-all ${
                viewMode === 'enterprise'
                  ? 'bg-[#2283B8] text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Enterprise
            </button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {filteredProjects.map((project, index) => (
            <SystemPortfolioCard
              key={index}
              projectName={project.projectName}
              systemType={project.systemType}
              industry={project.industry}
              icon={project.icon}
              techStack={project.techStack}
              overview={project.overview}
              capabilities={project.capabilities}
              classification={project.classification}
              architectureDiagram={project.architectureDiagram}
              delay={index * 0.1}
              isEnterprise={viewMode === 'enterprise'}
              enterpriseFocus={project.enterpriseFocus}
              deploymentModel={project.deploymentModel}
              enterpriseSystemType={project.enterpriseSystemType}
              technicalArchitecture={project.technicalArchitecture}
            />
          ))}
        </div>

        <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent mb-12" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <p className="text-lg text-gray-300 mb-6 max-w-2xl mx-auto">
            Need a system engineered around real operational and security requirements?
          </p>
          <button
            onClick={() => onNavigate('contact')}
            className="px-8 py-3 bg-[#2283B8] text-white rounded-lg font-medium hover:bg-[#2BB0E8] transition-colors shadow-lg shadow-[#2283B8]/20"
          >
            Request a Technical Consultation
          </button>
        </motion.div>
      </div>
    </div>
  );
};
