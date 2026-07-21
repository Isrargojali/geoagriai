import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Alert,
  Badge,
  DistributionBar,
  EmptyState,
  HealthBadge,
  statusBadgeColor,
} from '@/components/ui';

describe('UI components', () => {
  it('maps statuses to badge colors', () => {
    expect(statusBadgeColor('COMPLETED')).toBe('green');
    expect(statusBadgeColor('PENDING')).toBe('yellow');
    expect(statusBadgeColor('FAILED')).toBe('red');
    expect(statusBadgeColor('POOR')).toBe('orange');
    expect(statusBadgeColor('CANCELLED')).toBe('gray');
  });

  it('renders a badge with its label', () => {
    render(<Badge color="green">Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders health badges including the no-data case', () => {
    const { rerender } = render(<HealthBadge status="EXCELLENT" />);
    expect(screen.getByText('Excellent')).toBeInTheDocument();
    rerender(<HealthBadge status={null} />);
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('renders alerts with content', () => {
    render(<Alert kind="warning">Trial expiring soon</Alert>);
    expect(screen.getByText('Trial expiring soon')).toBeInTheDocument();
  });

  it('renders the NDVI distribution legend', () => {
    render(
      <DistributionBar
        distribution={{ critical: 0.1, poor: 0.2, moderate: 0.3, good: 0.3, excellent: 0.1 }}
      />,
    );
    expect(screen.getByText(/Critical 10%/)).toBeInTheDocument();
    expect(screen.getByText(/Excellent 10%/)).toBeInTheDocument();
  });

  it('renders empty states with title, message and action', () => {
    render(
      <EmptyState title="No farms yet" message="Create one" action={<button>Create</button>} />,
    );
    expect(screen.getByText('No farms yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
  });
});
