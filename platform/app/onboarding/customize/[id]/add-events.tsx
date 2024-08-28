"use client";

import { Spinner } from "@/components/small-spinner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import {
  DetectionScope,
  EventDefinition,
  ScoreRangeType,
} from "@/models/models";
import { navigationStateStore } from "@/store/store";
import { useUser } from "@propelauth/nextjs/client";
import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { sendUserFeedback } from "phospho";
import { useEffect, useState } from "react";

function EventDisplay({
  eventDefintion,
  onToggle,
  isSelected,
}: {
  eventDefintion: EventDefinition;
  onToggle: () => void;
  isSelected: boolean;
}) {
  // This is a single component that displays an event definition
  // It also has a tickbox to enable or disable the event for the project
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-row items-center space-x-4">
          <Checkbox
            className="h-8 w-8"
            onClick={onToggle}
            checked={isSelected}
          />
          <CardTitle>{eventDefintion.event_name}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription>{eventDefintion.description}</CardDescription>
      </CardContent>
    </Card>
  );
}

const dummyEventDefinitions: EventDefinition[] = [];

export default function AddEvents({
  project_id,
  phosphoTaskId,
  redirectTo = "/onboarding/plan",
}: {
  project_id: string;
  phosphoTaskId: string | null;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [customEvents, setCustomEvents] = useState<EventDefinition[] | null>(
    null,
  );

  const template = "Select a template";
  const [selectedTemplate, setSelectedTemplate] = useState(template);
  let selectedOrgId =
    navigationStateStore((state) => state.selectedOrgId) ?? "";
  const { loading, accessToken } = useUser();
  const { toast } = useToast();

  const [isSelected, setIsSelected] = useState<{ [key: string]: boolean }>(
    dummyEventDefinitions?.reduce(
      (acc, eventDefintion) => ({
        ...acc,
        [eventDefintion.event_name]: false,
      }),
      {},
    ),
  );

  const [sendEventsLoading, setSendEventsLoading] = useState(false);

  useEffect(() => {
    if (customEvents) {
      setIsSelected(
        customEvents.reduce(
          (acc, eventDefintion) => ({
            ...acc,
            [eventDefintion.event_name]: true,
          }),
          {},
        ),
      );
    }
  }, [customEvents]);

  const handleToggle = (eventName: string) => {
    setIsSelected((prevIsSelected) => ({
      ...prevIsSelected,
      [eventName]: !prevIsSelected[eventName],
    }));
  };

  const saveSelectedEvents = async () => {
    const selectedEvents = Object.entries(isSelected)
      ?.filter(([_key, value]) => value)
      ?.map(([key, _value]) => key);
    // Now get the full events from custom events
    // and save the selected events to the project
    const selectedEventDefinitions = customEvents?.filter((eventDefintion) =>
      selectedEvents.includes(eventDefintion.event_name),
    );
    console.log("Selected Event Definitions:", selectedEventDefinitions);

    const response = await fetch(`/api/projects/${project_id}/add-events`, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // provide a list of the selected events in customEvents
        events: selectedEventDefinitions,
      }),
    });
    if (phosphoTaskId !== null) {
      try {
        sendUserFeedback({
          taskId: phosphoTaskId,
          projectId: "b20659d0932d4edbb2b9682d3e6a0ccb",
          flag:
            (selectedEventDefinitions?.length ?? 0) > 0 ? "success" : "failure",
          source: "user",
          notes: `Selected ${
            selectedEventDefinitions?.length ?? 0
          } events: ${selectedEventDefinitions
            ?.map((event) => event.event_name)
            .join(", ")}`,
        });
      } catch (e) {
        console.error("Error sending feedback to Phospho", e);
      }
    } else {
      console.error("Phospho task_id is null");
    }
  };

  const generateEvents = (eventType: string) => {
    let events: EventDefinition[];
    if (eventType === "Text generation") {
      events = [
        {
          project_id: project_id,
          event_name: "Sounds robotic",
          description: "The text generated by the assistant sounds robotic.",
          org_id: selectedOrgId,
          detection_scope: DetectionScope.TaskOutputOnly,
        },
        {
          project_id: project_id,
          event_name: "Repetitive output",
          description: "The assistant has generated a repetitive text.",
          org_id: selectedOrgId,
          detection_scope: DetectionScope.TaskOutputOnly,
        },
        {
          project_id: project_id,
          event_name: "Positive sentiment",
          description:
            "The assistant has generated a warm and positive response.",
          org_id: selectedOrgId,
          detection_scope: DetectionScope.TaskOutputOnly,
          score_range_settings: {
            min: 1,
            max: 5,
            score_type: ScoreRangeType.range,
            categories: [],
          },
        },
        {
          project_id: project_id,
          event_name: "Toxic content",
          description:
            "The assistant has generated curse words or toxic content.",
          org_id: selectedOrgId,
          detection_scope: DetectionScope.TaskOutputOnly,
        },
      ];
    } else if (eventType === "Customer support") {
      events = [
        {
          project_id: project_id,
          event_name: "Penetration testing",
          description: "The user is trying to jailbreak the LLM app.",
          org_id: selectedOrgId,
          detection_scope: DetectionScope.TaskInputOnly,
        },
        {
          project_id: project_id,
          event_name: "User wants to talk to a human",
          description: "The user is asking to talk to a human.",
          org_id: selectedOrgId,
          detection_scope: DetectionScope.TaskInputOnly,
        },
        {
          project_id: project_id,
          event_name: "Positive sentiment",
          description: "The user expresses satisfaction to the assistant.",
          org_id: selectedOrgId,
          detection_scope: DetectionScope.TaskInputOnly,
          score_range_settings: {
            min: 1,
            max: 5,
            score_type: ScoreRangeType.range,
            categories: [],
          },
        },
        {
          project_id: project_id,
          event_name: "Toxic response",
          description:
            "The assistant has generated curse words or a toxic response.",
          org_id: selectedOrgId,
          detection_scope: DetectionScope.TaskOutputOnly,
        },
      ];
    } else {
      events = [
        {
          project_id: project_id,
          event_name: "Follow-up action",
          description: "The assistant proposes or executes a follow-up action.",
          org_id: selectedOrgId,
          detection_scope: DetectionScope.Session,
        },
        {
          project_id: project_id,
          event_name: "Positive sentiment",
          description:
            "The reponse generated by the assistant has warmth and is positive.",
          org_id: selectedOrgId,
          detection_scope: DetectionScope.TaskOutputOnly,
          score_range_settings: {
            min: 1,
            max: 5,
            score_type: ScoreRangeType.range,
            categories: [],
          },
        },
        {
          project_id: project_id,
          event_name: "Toxic generation",
          description:
            "The assistant has generated curse words or a toxic response.",
          org_id: selectedOrgId,
          detection_scope: DetectionScope.Task,
        },
        {
          project_id: project_id,
          event_name: "Verbose response",
          description:
            "The assistant has generated a verbose response when the user only wanted a brief response.",
          org_id: selectedOrgId,
          detection_scope: DetectionScope.Task,
        },
      ];
    }
    setCustomEvents(events);
    setSelectedTemplate(eventType);
  };

  return (
    <>
      <Card className="max-w-1/2">
        <CardHeader>
          <CardTitle>Setup analytics for this project</CardTitle>
          <CardDescription>
            phospho runs automated analytics to augment your data with tags,
            scores, and labels.
          </CardDescription>
          <CardDescription className="pt-2">
            Select a template to get started.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col space-y-2 border-gray-500">
          <div className="flex justify-center align-items">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex justify-center">
                <Button variant="outline" className="mb-2">
                  {selectedTemplate}
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onClick={() => generateEvents("Text generation")}
                >
                  Text generation
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => generateEvents("Customer support")}
                >
                  Customer support
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => generateEvents("Writing assistant")}
                >
                  Writing assistant
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex flex-col space-y-2 overflow-y-auto h-96">
            {customEvents &&
              customEvents?.map &&
              customEvents?.map((eventDefinition) => (
                <EventDisplay
                  eventDefintion={eventDefinition}
                  key={eventDefinition.event_name}
                  onToggle={() => handleToggle(eventDefinition.event_name)}
                  isSelected={isSelected[eventDefinition.event_name]}
                />
              ))}
          </div>
          <div className="text-muted-foreground text-sm">
            You can customize these later in the Analytics section.
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            variant="link"
            onClick={() => {
              router.push(redirectTo);
            }}
          >
            Skip
          </Button>
          <Button
            onClick={async () => {
              setSendEventsLoading(true);
              saveSelectedEvents().then((response) => {
                router.push(redirectTo);
                toast({
                  title: "Your config has been saved! 🎉",
                  description: `Change the config in Analytics`,
                });
              });
            }}
            disabled={loading || customEvents === null}
          >
            {sendEventsLoading && <Spinner className="mr-1" />}
            Save and continue
          </Button>
        </CardFooter>
      </Card>
    </>
  );
}
