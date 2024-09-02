"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { getEventsFromTemplateName } from "@/lib/events-lib";
import { authFetcher } from "@/lib/fetcher";
import {
  DetectionEngine,
  DetectionScope,
  EventDefinition,
  Project,
  ScoreRangeType,
} from "@/models/models";
import { ScoreRangeSettings } from "@/models/models";
import { dataStateStore, navigationStateStore } from "@/store/store";
import { zodResolver } from "@hookform/resolvers/zod";
import { useUser } from "@propelauth/nextjs/client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import useSWR, { useSWRConfig } from "swr";
import { z } from "zod";

export default function CreateEvent({
  setOpen,
  eventToEdit,
  defaultEventCategory,
}: {
  setOpen: (open: boolean) => void;
  eventToEdit?: EventDefinition;
  defaultEventCategory?: string;
}) {
  /* Create a new event definition (analytics) or edit an existing event definition (analytics)
   */

  const selectedOrgId = navigationStateStore((state) => state.selectedOrgId);
  const project_id = navigationStateStore((state) => state.project_id);
  const orgMetadata = dataStateStore((state) => state.selectedOrgMetadata);
  const { mutate } = useSWRConfig();
  const { loading, accessToken } = useUser();
  const { toast } = useToast();
  const { data: selectedProject }: { data: Project } = useSWR(
    project_id ? [`/api/projects/${project_id}`, accessToken] : null,
    ([url, accessToken]) => authFetcher(url, accessToken, "GET"),
    {
      keepPreviousData: true,
    },
  );
  const [eventsTemplate, setEventsTemplate] = useState<EventDefinition[]>([]);

  const currentEvents = selectedProject?.settings?.events || {};

  // Max number of events depends on the plan
  const max_nb_events = orgMetadata?.plan === "pro" ? 100 : 10;
  const current_nb_events = Object.keys(currentEvents).length;

  useEffect(() => {
    if (selectedOrgId && project_id) {
      setEventsTemplate(
        getEventsFromTemplateName("All", selectedOrgId, project_id),
      );
    }
  }, [selectedOrgId, project_id]);

  // If we are editing an event, we need to pre-fill the form
  const formSchema = z.object({
    event_name: z
      .string()
      .min(2, {
        message: "Event name must be at least 2 characters.",
      })
      .max(32, {
        message: "Event name must be at most 32 characters.",
      }),
    description: z
      .string()
      .min(10, "Description must be at least 10 characters long.")
      .max(1000, "Description must be at most 1000 characters long."),
    webhook: z.string().optional(),
    webhook_auth_header: z.string().optional(),
    detection_engine: z
      .enum(["llm_detection", "regex_detection", "keyword_detection"])
      .default("llm_detection"),
    detection_scope: z
      .enum(["task", "session", "task_input_only", "task_output_only"])
      .default("task"),
    keywords: z.string().optional(),
    regex_pattern: z.string().optional(),
    score_range_settings: z
      .object({
        score_type: z.enum([
          ScoreRangeType.category,
          ScoreRangeType.confidence,
          ScoreRangeType.range,
        ]),
        categories: z.any().transform((value, ctx) => {
          console.log("Categories", value);
          // If array of string, return it
          if (Array.isArray(value)) {
            value = value.filter((category) => category !== "");
            if (value.length < 1 || value.length > 9) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Categories must be between 1 and 9.",
              });
              return z.NEVER;
            }
            return value;
          }
          // If not a string, raise an error
          if (typeof value !== "string") {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Categories must be a string.",
            });
            return z.NEVER;
          }
          // Split the string into an array of categories
          let categories = value.split(",").map((category) => category.trim());
          // Remove empty strings
          categories = categories.filter((category) => category !== "");
          return categories;
        }),
      })
      .transform((value, ctx) => {
        console.log("Score range settings value transform", value);
        // Raise an error if there are less than 1 category or more than 9
        if (value.score_type === ScoreRangeType.confidence) {
          return {
            score_type: ScoreRangeType.confidence,
            min: 0,
            max: 1,
            categories: [],
          };
        }
        if (value.score_type === ScoreRangeType.range) {
          return {
            score_type: ScoreRangeType.range,
            min: 1,
            max: 5,
            categories: [],
          };
        }
        if (value.score_type === ScoreRangeType.category) {
          if (value.categories.length < 1 || value.categories.length > 9) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Categories must be between 1 and 9.",
            });
            return z.NEVER;
          }
          return {
            score_type: ScoreRangeType.category,
            min: 1,
            max: value.categories.length,
            categories: value.categories,
          };
        }
      })
      .optional(),
    is_last_task: z.boolean(),
  });

  let defaultScoreRangeSettings = {
    score_type: ScoreRangeType.confidence,
    min: 0,
    max: 1,
    categories: [],
  } as ScoreRangeSettings;
  console.log("defaultEventCategory", defaultEventCategory);
  if (eventToEdit?.score_range_settings) {
    defaultScoreRangeSettings = eventToEdit.score_range_settings;
  } else {
    if (defaultEventCategory === ScoreRangeType.confidence) {
      defaultScoreRangeSettings = {
        score_type: ScoreRangeType.confidence,
        min: 0,
        max: 1,
        categories: [],
      };
    }
    if (defaultEventCategory === ScoreRangeType.range) {
      defaultScoreRangeSettings = {
        score_type: ScoreRangeType.range,
        min: 1,
        max: 5,
        categories: [],
      };
    }
    if (defaultEventCategory === ScoreRangeType.category) {
      defaultScoreRangeSettings = {
        score_type: ScoreRangeType.category,
        min: 1,
        max: 1,
        categories: [],
      };
    }
  }

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      event_name: eventToEdit?.event_name ?? "",
      description: eventToEdit?.description ?? "",
      webhook: eventToEdit?.webhook ?? "",
      webhook_auth_header: eventToEdit?.webhook_headers?.Authorization ?? "",
      detection_engine: eventToEdit?.detection_engine ?? "llm_detection",
      detection_scope: eventToEdit?.detection_scope ?? "task",
      keywords: eventToEdit?.keywords ?? "",
      regex_pattern: eventToEdit?.regex_pattern ?? "",
      score_range_settings: defaultScoreRangeSettings,
      is_last_task: eventToEdit?.is_last_task ?? false,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    console.log("Submitting event:", values);
    if (!selectedProject) {
      console.log("Submit: No selected project");
      return;
    }
    if (!selectedProject.settings) {
      console.log("Submit: No selected project settings");
      return;
    }
    if (
      eventToEdit !== undefined &&
      eventToEdit.event_name !== values.event_name
    ) {
      // Editing the event means that we remove the previous event and add the new one
      // This is in case the event name has changed
      delete selectedProject.settings.events[eventToEdit.event_name];
    }

    // On purpose, we do not pass the job_id, so a new job object will be created for this event
    selectedProject.settings.events[values.event_name] = {
      project_id: selectedProject.id,
      org_id: selectedProject.org_id,
      event_name: values.event_name,
      description: values.description,
      webhook: values.webhook,
      webhook_headers: values.webhook_auth_header
        ? { Authorization: values.webhook_auth_header }
        : null,
      detection_engine: values.detection_engine as DetectionEngine,
      detection_scope: values.detection_scope as DetectionScope,
      keywords: values.keywords,
      regex_pattern: values.regex_pattern,
      score_range_settings: values.score_range_settings,
      is_last_task: values.is_last_task,
    };
    console.log("Updated selected project:", selectedProject);

    try {
      const creation_response = await fetch(`/api/projects/${project_id}`, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(selectedProject),
      }).then((response) => {
        setOpen(false);
        mutate(
          [`/api/projects/${project_id}`, accessToken],
          async (data: any) => {
            return { project: selectedProject };
          },
        );
      });
    } catch (error) {
      toast({
        title: "Error when creating event",
        description: `${error}`,
      });
    }
  }

  return (
    <div className="space-y-2">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="font-normal space-y-4"
          key={`createEventForm${eventToEdit?.event_name}`}
        >
          <SheetHeader>
            <SheetTitle className="text-xl">
              {!eventToEdit && <div>Setup new event</div>}
              {eventToEdit && <div>Edit event "{eventToEdit?.event_name}"</div>}
            </SheetTitle>
          </SheetHeader>
          {/* <Separator /> */}
          {/* Event templates */}
          <div>
            <h2 className="text-muted-foreground text-xs mb-1">Templates</h2>
            <div className="flex flex-wrap">
              {eventsTemplate.map((eventDefinition) => {
                return (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="text-xs m-0.5"
                      onClick={(mouseEvent) => {
                        mouseEvent.stopPropagation();
                        form.setValue("event_name", eventDefinition.event_name);
                        form.setValue(
                          "description",
                          eventDefinition.description,
                        );
                        form.setValue(
                          "detection_scope",
                          eventDefinition.detection_scope,
                        );
                        form.setValue("keywords", eventDefinition.keywords);
                        form.setValue(
                          "regex_pattern",
                          eventDefinition.regex_pattern,
                        );
                        form.setValue("detection_engine", "llm_detection");
                        form.setValue(
                          "is_last_task",
                          eventDefinition.is_last_task ?? false,
                        );

                        if (eventDefinition.score_range_settings) {
                          const scoreRangeSettings = {
                            score_type:
                              eventDefinition.score_range_settings.score_type ??
                              (ScoreRangeType.confidence as ScoreRangeType),
                            min: eventDefinition.score_range_settings.min ?? 0,
                            max: eventDefinition.score_range_settings.max ?? 1,
                            categories:
                              eventDefinition.score_range_settings.categories ??
                              [],
                          };

                          form.setValue(
                            "score_range_settings",
                            scoreRangeSettings,
                          );
                        } else {
                          form.setValue("score_range_settings", {
                            score_type: ScoreRangeType.confidence,
                            categories: [],
                            min: 0,
                            max: 1,
                          });
                        }

                        // Prevent the form from submitting
                        mouseEvent.preventDefault();
                      }}
                    >
                      {eventDefinition.event_name}
                    </Button>
                  </>
                );
              })}
            </div>
          </div>
          <Separator />
          <div className="flex-col space-y-2">
            <div className="flex flex-row items-center space-x-2">
              <FormField
                control={form.control}
                name="event_name"
                render={({ field }) => (
                  <FormItem className="flex-grow">
                    <FormLabel>Event name*</FormLabel>
                    <FormControl>
                      <Input
                        spellCheck
                        placeholder={
                          "e.g.: rude tone of voice, user frustration, user says 'I want to cancel'..."
                        }
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="detection_scope"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Detection scope</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value ?? "task"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent position="popper">
                        <SelectItem value="task">Task</SelectItem>
                        <SelectItem value="session">Session</SelectItem>
                        <SelectItem value="task_input_only">
                          Task input only
                        </SelectItem>
                        <SelectItem value="task_output_only">
                          Task output only
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description*</FormLabel>
                  <FormControl>
                    <Textarea
                      id="description"
                      placeholder={
                        "Use simple language. Refer to speakers as 'the user' and 'the assistant'."
                      }
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="detection_engine"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Engine</FormLabel>
                  <Select
                    value={field.value ?? "llm_detection"}
                    onValueChange={field.onChange}
                    defaultValue={field.value ?? "llm_detection"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          defaultValue={field.value ?? "llm_detection"}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent position="popper">
                      <SelectItem value="llm_detection">
                        LLM Detection
                      </SelectItem>
                      <SelectItem value="keyword_detection">
                        Keyword Detection
                      </SelectItem>
                      <SelectItem value="regex_detection">
                        Regex Detection
                      </SelectItem>
                      <SelectItem disabled value="other">
                        More coming soon!
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            {
              // specify the scoreRangeSettings for the LLM detection engine
              form.watch("detection_engine") === "llm_detection" && (
                // Let user pick the scoreRangeSettings.score_type. Then, prefill the min and max values based on the score_type
                <FormField
                  control={form.control}
                  name="score_range_settings"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Output type</FormLabel>
                      <FormControl>
                        <Select
                          value={
                            field.value?.score_type ?? ScoreRangeType.confidence
                          }
                          onValueChange={(value) => {
                            if (value === ScoreRangeType.confidence) {
                              field.onChange({
                                score_type: ScoreRangeType.confidence,
                                min: 0,
                                max: 1,
                                categories: "",
                              });
                            } else if (value === ScoreRangeType.range) {
                              field.onChange({
                                score_type: "range",
                                min: 1,
                                max: 5,
                                categories: "",
                              });
                            } else if (value === ScoreRangeType.category) {
                              field.onChange({
                                score_type: "category",
                                min: 1,
                                max: 1,
                                categories:
                                  form.getValues().score_range_settings
                                    ?.categories ?? [],
                              });
                            }
                          }}
                          defaultValue={
                            field.value?.score_type ?? ScoreRangeType.confidence
                          }
                        >
                          <SelectTrigger>
                            <SelectValue
                              defaultValue={
                                field.value?.score_type ??
                                ScoreRangeType.confidence
                              }
                            />
                          </SelectTrigger>
                          <SelectContent position="popper">
                            <SelectItem value={ScoreRangeType.confidence}>
                              Yes/No (boolean)
                            </SelectItem>
                            <SelectItem value={ScoreRangeType.range}>
                              1-5 score (number)
                            </SelectItem>
                            <SelectItem value={ScoreRangeType.category}>
                              Category (enum)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )
            }
            {form.watch("detection_engine") === "llm_detection" &&
              form.watch("score_range_settings")?.score_type === "category" && (
                <FormField
                  control={form.control}
                  name="score_range_settings.categories"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categories</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="happy,sad,neutral"
                          {...field}
                          onChange={(e) => {
                            const value = e.target.value;
                            field.onChange({
                              target: { value: value.split(",") },
                            });
                            // update the score_range_settings object
                            console.log(
                              "Setting categories to",
                              value.split(","),
                            );
                            form.resetField("score_range_settings.score_type");
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            {form.watch("detection_engine") === "keyword_detection" && (
              <FormField
                control={form.control}
                name="keywords"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      List of words to detect, separated by a comma
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="question, why, how, what"
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}
            {form.watch("detection_engine") === "regex_detection" && (
              <FormField
                control={form.control}
                name="regex_pattern"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Regex pattern to match - </FormLabel>
                    <Link
                      className="hover:underline hover:text-blue-500"
                      href="https://regexr.com/"
                    >
                      Test your regex pattern here
                    </Link>{" "}
                    <FormMessage>
                      Be careful, "happy" will also match "unhappy" unless you
                      add whitespaces like so: " happy "
                    </FormMessage>
                    <FormControl>
                      <Input
                        placeholder="^[0-9]{5}$ or why | how | what"
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="is_last_task"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-1 space-y-0 py-1">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="font-medium text-muted-foreground">
                    Only detect on the last message of a session
                  </FormLabel>
                </FormItem>
              )}
            />
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger>
                  Advanced settings (optional)
                </AccordionTrigger>
                <AccordionContent>
                  <Separator />
                  <div className="flex flex-row space-x-2 w-full mt-2">
                    <FormField
                      control={form.control}
                      name="webhook"
                      render={({ field }) => (
                        <FormItem className="flex-grow">
                          <FormLabel className="text-muted-foreground">
                            Webhook URL
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://your-api.com/webhook"
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="webhook_auth_header"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">
                            Authorization Header
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="Bearer sk-..." {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
          <SheetFooter>
            <Button type="submit" disabled={loading}>
              {!eventToEdit && <div>Add event</div>}
              {eventToEdit && <div>Save edits</div>}
            </Button>
          </SheetFooter>
        </form>
      </Form>
    </div>
  );
}
