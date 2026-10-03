import { Alert, Center } from '@mantine/core';
import { Component, type ReactNode } from 'react';

/** If the browser cannot draw 3D (no WebGL), explain instead of showing a blank page. */
export class ViewportErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Center h="100%" p="xl">
        <Alert color="orange" title="The 3D view could not start" maw={480}>
          Your browser could not draw 3D graphics (WebGL). Try Chrome, Edge or Firefox, and make sure
          “hardware acceleration” is turned on in the browser settings. Your work is still saved.
        </Alert>
      </Center>
    );
  }
}
