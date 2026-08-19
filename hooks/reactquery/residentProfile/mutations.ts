"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  residentSetNotifyPrefs,
  type ResidentNotifyPrefsInput,
  type ResidentProfileResult,
} from "./apis";
import { residentProfileKeys } from "./keys";

export function useSetNotifyPrefs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (args: ResidentNotifyPrefsInput) =>
      residentSetNotifyPrefs(args),
    onMutate: async (args) => {
      await queryClient.cancelQueries({
        queryKey: residentProfileKeys.profile(),
      });
      const previous = queryClient.getQueryData<ResidentProfileResult>(
        residentProfileKeys.profile(),
      );
      queryClient.setQueryData<ResidentProfileResult>(
        residentProfileKeys.profile(),
        (current) =>
          current
            ? {
                ...current,
                alimtalkOptIn: args.alimtalk ?? current.alimtalkOptIn,
                smsOptIn: args.sms ?? current.smsOptIn,
              }
            : current,
      );
      return { previous };
    },
    onError: (_error, _args, context) => {
      if (context) {
        queryClient.setQueryData(
          residentProfileKeys.profile(),
          context.previous,
        );
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: residentProfileKeys.all }),
  });
}
