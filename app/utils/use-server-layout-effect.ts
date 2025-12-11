import { useEffect, useLayoutEffect, useState } from "react";
import { isRunningOnServer } from "./is-running-on-server";

export const useServerLayoutEffect = isRunningOnServer()
  ? useEffect
  : useLayoutEffect;
