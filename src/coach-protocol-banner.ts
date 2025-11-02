// ABOUTME: Renders protocol suggestion banner with start/dismiss actions.
// ABOUTME: Handles single and multiple protocol layouts.

import { ReviewProtocol } from "./types";

export interface ProtocolBannerCallbacks {
  onStart?: (protocol: ReviewProtocol) => void;
  onDismiss?: () => void;
}

export class CoachProtocolBanner {
  /**
   * Render protocol banner to container.
   * Different layouts for single vs multiple protocols.
   */
  render(
    container: HTMLElement,
    protocols: ReviewProtocol[],
    callbacks?: ProtocolBannerCallbacks
  ): void {
    if (protocols.length === 0) {
      return;
    }

    const bannerEl = document.createElement("div");
    bannerEl.className = "coach-protocol-banner";
    container.appendChild(bannerEl);

    if (protocols.length === 1) {
      // Simple layout for single protocol
      this.renderSingleProtocol(bannerEl, protocols[0], callbacks);
    } else {
      // List layout for multiple protocols
      this.renderMultipleProtocols(bannerEl, protocols, callbacks);
    }
  }

  private renderSingleProtocol(
    container: HTMLElement,
    protocol: ReviewProtocol,
    callbacks?: ProtocolBannerCallbacks
  ): void {
    const textEl = document.createElement("div");
    textEl.className = "coach-protocol-text";
    textEl.textContent = `📅 ${protocol.name} is available`;
    container.appendChild(textEl);

    const buttonsEl = document.createElement("div");
    buttonsEl.className = "coach-protocol-buttons";
    container.appendChild(buttonsEl);

    const startBtn = document.createElement("button");
    startBtn.className = "coach-protocol-start";
    startBtn.textContent = "Start";
    buttonsEl.appendChild(startBtn);
    startBtn.addEventListener("click", () => {
      callbacks?.onStart?.(protocol);
      container.remove();
    });

    const dismissBtn = document.createElement("button");
    dismissBtn.className = "coach-protocol-dismiss";
    dismissBtn.textContent = "Dismiss";
    buttonsEl.appendChild(dismissBtn);
    dismissBtn.addEventListener("click", () => {
      callbacks?.onDismiss?.();
      container.remove();
    });
  }

  private renderMultipleProtocols(
    container: HTMLElement,
    protocols: ReviewProtocol[],
    callbacks?: ProtocolBannerCallbacks
  ): void {
    const textEl = document.createElement("div");
    textEl.className = "coach-protocol-text";
    textEl.textContent = "📅 Reviews available:";
    container.appendChild(textEl);

    const listEl = document.createElement("ul");
    listEl.className = "coach-protocol-list";
    container.appendChild(listEl);

    for (const protocol of protocols) {
      const itemEl = document.createElement("li");
      itemEl.className = "coach-protocol-item";
      itemEl.textContent = `• ${protocol.name} `;
      listEl.appendChild(itemEl);

      const startBtn = document.createElement("button");
      startBtn.className = "coach-protocol-start";
      startBtn.textContent = "[Start]";
      itemEl.appendChild(startBtn);
      startBtn.addEventListener("click", () => {
        callbacks?.onStart?.(protocol);
        container.remove();
      });
    }

    const dismissBtn = document.createElement("button");
    dismissBtn.className = "coach-protocol-dismiss";
    dismissBtn.textContent = "Dismiss All";
    container.appendChild(dismissBtn);
    dismissBtn.addEventListener("click", () => {
      callbacks?.onDismiss?.();
      container.remove();
    });
  }
}
