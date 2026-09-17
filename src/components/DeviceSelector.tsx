interface DeviceSelectorProps {
  devices: MediaDeviceInfo[];
  selectedDeviceId: string | undefined;
  onChange: (deviceId: string) => void;
  disabled: boolean;
}

export function DeviceSelector({ devices, selectedDeviceId, onChange, disabled }: DeviceSelectorProps) {
  if (devices.length === 0) {
    return <p className="device-hint">Microphone list appears after the first permission grant.</p>;
  }
  return (
    <label className="device-selector">
      Microphone:{' '}
      <select value={selectedDeviceId ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        <option value="">Default</option>
        {devices.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || `Microphone ${d.deviceId.slice(0, 6)}`}
          </option>
        ))}
      </select>
    </label>
  );
}
