import { useEffect, useMemo, useState } from "react";
import type {
  AppLayoutState,
  LayoutViewport,
  UseAppLayoutOptions,
} from "./layoutTypes";

const TABLET_MIN_WIDTH = 768;
const DESKTOP_MIN_WIDTH = 1200;
const SIDEBAR_MIN = 260;
const LIST_MIN = 440;
const DETAIL_MIN = 380;

const SIDEBAR_LIST_MIN = SIDEBAR_MIN + LIST_MIN;
const LIST_DETAIL_MIN = LIST_MIN + DETAIL_MIN;
const SIDEBAR_LIST_DETAIL_MIN = SIDEBAR_MIN + LIST_MIN + DETAIL_MIN;

function getViewport(width: number): LayoutViewport {
  if (width >= DESKTOP_MIN_WIDTH) {
    return "desktop";
  }

  if (width >= TABLET_MIN_WIDTH) {
    return "tablet";
  }

  return "mobile";
}

function getWindowWidth() {
  if (typeof window === "undefined") {
    return DESKTOP_MIN_WIDTH;
  }

  return window.innerWidth;
}

export function useAppLayout({
  selectedTaskId,
}: UseAppLayoutOptions): AppLayoutState {
  const [windowWidth, setWindowWidth] = useState(getWindowWidth);

  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return useMemo(() => {
    const viewport = getViewport(windowWidth);
    const hasSelectedTask = Boolean(selectedTaskId);

    if (!hasSelectedTask) {
      if (windowWidth < SIDEBAR_LIST_MIN) {
        return {
          viewport,
          mode: "mobile-list-only",
          visiblePanels: ["list"],
        };
      }

      if (viewport === "desktop") {
        return {
          viewport,
          mode: "desktop-sidebar-list",
          visiblePanels: ["sidebar", "list"],
        };
      }

      return {
        viewport,
        mode: "tablet-sidebar-list",
        visiblePanels: ["sidebar", "list"],
      };
    }

    if (windowWidth < LIST_DETAIL_MIN) {
      return {
        viewport,
        mode: "mobile-detail-only",
        visiblePanels: ["detail"],
      };
    }

    if (windowWidth < SIDEBAR_LIST_DETAIL_MIN) {
      return {
        viewport,
        mode: "tablet-list-detail",
        visiblePanels: ["list", "detail"],
      };
    }

    return {
      viewport,
      mode: "desktop-sidebar-list-detail",
      visiblePanels: ["sidebar", "list", "detail"],
    };
  }, [selectedTaskId, windowWidth]);
}
