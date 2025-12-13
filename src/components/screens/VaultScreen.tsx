// @ts-nocheck
/* eslint-disable */
import { Download, Volume2, Crown, Hammer, Layers } from 'lucide-react';
import { mockCurrentUser } from '../../data/mockData';

interface VaultScreenProps {
  onOpenConnectionManagement?: () => void;
  onSignOut?: () => void;
}

export function VaultScreen({ onOpenConnectionManagement, onSignOut }: VaultScreenProps) {
  const currentTier = 'Mason';

  const tiers = [
    {
      name: 'Sketcher',
      price: 'Free',
      priceValue: 0,
      icon: Layers,
      color: '#546e7a',
      features: [
        '10 Bond Slots',
        '320kbps Audio Quality',
        '2 Artist Patronage Slots',
        'Basic Blueprint Creation',
      ],
      isCurrent: currentTier === 'Sketcher',
    },
    {
      name: 'Mason',
      price: '$4.99/mo',
      priceValue: 4.99,
      icon: Hammer,
      color: '#d32f2f',
      features: [
        '25 Bond Slots',
        'Hi-Res Audio (FLAC)',
        '2 Artist Patronage Slots',
        'Advanced Analytics',
        'Priority Support',
      ],
      isCurrent: currentTier === 'Mason',
    },
    {
      name: 'Architect',
      price: '$9.99/mo',
      priceValue: 9.99,
      icon: Crown,
      color: '#c6a700',
      features: [
        '50 Bond Slots',
        'Hi-Res Audio (24-bit)',
        '3 Artist Patronage Slots',
        'Advanced Analytics',
        'Priority Artist Payouts',
        'Early Access to New Artists',
        'Exclusive Content',
      ],
      isCurrent: currentTier === 'Architect',
    },
  ];

  return (
    <div className="pb-24 px-6 pt-6 md:pt-16">
      {/* Header */}
      <div className="mb-8">
        <h2 className="mb-2">Account Blueprints</h2>
        <p style={{ color: '#a0a0a0' }}>Configure your foundation settings.</p>
      </div>

      {/* Membership Tiers */}
      <section className="mb-8">
        <h3 className="mb-4">Membership Tiers</h3>
        <div className="space-y-4">
          {tiers.map((tier) => {
            const TierIcon = tier.icon;
            return (
              <div
                key={tier.name}
                className="p-6 rounded-2xl relative overflow-hidden transition-all duration-200"
                style={{
                  backgroundColor: tier.isCurrent
                    ? 'rgba(37, 37, 37, 0.8)'
                    : 'rgba(37, 37, 37, 0.4)',
                  border: tier.isCurrent
                    ? `2px solid ${tier.color}`
                    : '1px solid rgba(255, 255, 255, 0.05)',
                  boxShadow: tier.isCurrent
                    ? `0 8px 24px ${tier.color}33`
                    : '0 4px 12px rgba(0, 0, 0, 0.3)',
                }}
              >
                {/* Current Badge */}
                {tier.isCurrent && (
                  <div
                    className="absolute top-4 right-4 px-3 py-1 rounded-full"
                    style={{
                      backgroundColor: `${tier.color}20`,
                      border: `1px solid ${tier.color}`,
                    }}
                  >
                    <span
                      className="mono"
                      style={{ color: tier.color, fontSize: '0.65rem' }}
                    >
                      CURRENT
                    </span>
                  </div>
                )}

                {/* Tier Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor: `${tier.color}20`,
                      border: `1px solid ${tier.color}`,
                    }}
                  >
                    <TierIcon size={24} color={tier.color} />
                  </div>
                  <div>
                    <h4 className="mb-1" style={{ color: '#e0e0e0' }}>
                      {tier.name}
                    </h4>
                    <p className="mono" style={{ color: tier.color, fontSize: '1.125rem' }}>
                      {tier.price}
                    </p>
                  </div>
                </div>

                {/* Features */}
                <ul className="mb-6 space-y-2">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <div
                        className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0"
                        style={{ backgroundColor: tier.color }}
                      />
                      <span style={{ color: '#cccccc', fontSize: '0.875rem' }}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Action Button */}
                {!tier.isCurrent && (
                  <button
                    className="w-full py-3 rounded-full transition-all duration-200 hover:scale-[1.02]"
                    style={{
                      background:
                        tier.name === 'Sketcher'
                          ? 'transparent'
                          : `linear-gradient(to bottom, ${tier.color}, ${tier.color}dd)`,
                      color: tier.name === 'Sketcher' ? tier.color : '#1a1a1a',
                      border: tier.name === 'Sketcher' ? `1px solid ${tier.color}` : 'none',
                      boxShadow:
                        tier.name === 'Sketcher'
                          ? 'none'
                          : `0 4px 16px ${tier.color}40`,
                      fontWeight: 600,
                    }}
                  >
                    {tier.name === 'Sketcher' ? 'Downgrade' : `Upgrade to ${tier.name}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Audio Quality */}
      <section className="mb-6">
        <h3 className="mb-4">Audio Quality</h3>
        <div
          className="p-6 rounded-lg"
          style={{
            backgroundColor: '#252525',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Volume2 size={20} color="#e0e0e0" />
              <h4 style={{ color: '#e0e0e0' }}>Force Hi-Res on Cellular</h4>
            </div>
            <div
              className="relative w-12 h-6 rounded-full cursor-pointer transition-colors"
              style={{ backgroundColor: '#d32f2f' }}
            >
              <div
                className="absolute top-1 right-1 w-4 h-4 rounded-full transition-all"
                style={{ backgroundColor: '#e0e0e0' }}
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="mono mb-2" style={{ color: '#a0a0a0', fontSize: '0.75rem' }}>
              QUALITY SELECTOR
            </p>
            {[
              { label: 'Gravel', value: '128kbps', active: false },
              { label: 'Stone', value: '320kbps', active: false },
              { label: 'Marble', value: 'FLAC', active: true },
            ].map((quality) => (
              <button
                key={quality.value}
                className="w-full p-3 rounded-lg text-left transition-all"
                style={{
                  backgroundColor: quality.active ? '#333333' : 'transparent',
                  border: '1px solid',
                  borderColor: quality.active ? '#d32f2f' : '#333333',
                }}
              >
                <div className="flex items-center justify-between">
                  <span style={{ color: '#e0e0e0' }}>{quality.label}</span>
                  <span className="mono" style={{ color: '#a0a0a0', fontSize: '0.75rem' }}>
                    {quality.value}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Data Export */}
      <section className="mb-6">
        <h3 className="mb-4">Data Ownership</h3>
        <div
          className="p-6 rounded-lg"
          style={{
            backgroundColor: '#252525',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          <p className="mb-4" style={{ color: '#a0a0a0', fontSize: '0.875rem' }}>
            You own your listening history. Download it as .CSV at any time.
          </p>
          <button
            className="w-full py-3 rounded-full flex items-center justify-center gap-2 transition-all hover:bg-[#2a2a2a]"
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #546e7a',
              color: '#546e7a',
            }}
          >
            <Download size={18} />
            Export My Data
          </button>
        </div>
      </section>

      {/* Account Actions */}
      <section className="mb-6">
        <h3 className="mb-4">Account</h3>
        <div className="space-y-3">
          <button
            className="w-full p-4 rounded-lg text-left transition-all hover:bg-[#2a2a2a]"
            style={{
              backgroundColor: '#252525',
              border: '1px solid #333333',
            }}
          >
            <p style={{ color: '#e0e0e0' }}>Privacy Settings</p>
          </button>
          <button
            className="w-full p-4 rounded-lg text-left transition-all hover:bg-[#2a2a2a]"
            style={{
              backgroundColor: '#252525',
              border: '1px solid #333333',
            }}
            onClick={onOpenConnectionManagement}
          >
            <p style={{ color: '#e0e0e0' }}>Bond Management</p>
          </button>
          <button
            className="w-full p-4 rounded-lg text-left transition-all hover:bg-[#2a2a2a]"
            style={{
              backgroundColor: '#252525',
              border: '1px solid #333333',
            }}
            onClick={onSignOut}
          >
            <p style={{ color: '#d32f2f' }}>Sign Out</p>
          </button>
        </div>
      </section>
    </div>
  );
}