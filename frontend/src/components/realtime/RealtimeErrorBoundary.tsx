import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export default class RealtimeErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[BRÚJULA:realtime-ui]", error);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}
