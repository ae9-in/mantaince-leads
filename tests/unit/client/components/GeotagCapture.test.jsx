// @vitest-environment jsdom
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GeotagCapture from '../../../../client/src/components/GeotagCapture.jsx';

vi.mock('exifr', () => ({
  gps: vi.fn(),
  default: {
    gps: vi.fn()
  }
}));

describe('GeotagCapture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hides component when leadType is not FIELD_VISIT', () => {
    const { container } = render(<GeotagCapture leadType="CALL" onChange={(() => {})} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows environmental camera file picker when leadType is FIELD_VISIT', () => {
    render(<GeotagCapture leadType="FIELD_VISIT" onChange={(() => {})} />);
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput.getAttribute('capture')).toBe('environment');
    expect(fileInput.getAttribute('accept')).toBe('image/*');
  });

  it('falls back to navigator.geolocation if EXIF contains no GPS', async () => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn((success) =>
        success({
          coords: { latitude: 12.9716, longitude: 77.5946, accuracy: 10 }
        })
      )
    };
    Object.defineProperty(navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
      configurable: true
    });

    const onChangeMock = vi.fn();
    render(<GeotagCapture leadType="FIELD_VISIT" onChange={onChangeMock} />);

    const fileInput = document.querySelector('input[type="file"]');
    const file = new File(['dummy content'], 'photo.jpg', { type: 'image/jpeg' });
    
    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      expect(mockGeolocation.getCurrentPosition).toHaveBeenCalled();
      expect(onChangeMock).toHaveBeenCalledWith(
        expect.objectContaining({ lat: 12.9716, lng: 77.5946 }),
        expect.any(File)
      );
    });
  });
});
