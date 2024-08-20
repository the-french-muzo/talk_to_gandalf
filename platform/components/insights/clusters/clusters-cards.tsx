"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { authFetcher } from "@/lib/fetcher";
import { formatUnixTimestampToLiteralDatetime } from "@/lib/time";
import { Cluster, Clustering, EventDefinition } from "@/models/models";
import { Project } from "@/models/models";
import { dataStateStore, navigationStateStore } from "@/store/store";
import { useUser } from "@propelauth/nextjs/client";
import { ChevronRight, Pickaxe, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { use, useEffect, useState } from "react";
import useSWR from "swr";

import CreateEvent from "../events/create-event";
import "./style.css";

function ClusterCard({
  project_id,
  cluster,
  setSheetClusterOpen,
}: {
  project_id: string;
  cluster: Cluster;
  setSheetClusterOpen: (value: boolean) => void;
}) {
  const { accessToken } = useUser();

  const router = useRouter();
  const dataFilters = navigationStateStore((state) => state.dataFilters);
  const setDataFilters = navigationStateStore((state) => state.setDataFilters);
  const orgMetadata = dataStateStore((state) => state.selectedOrgMetadata);

  const { data: selectedProject }: { data: Project } = useSWR(
    project_id ? [`/api/projects/${project_id}`, accessToken] : null,
    ([url, accessToken]) => authFetcher(url, accessToken, "GET"),
    {
      keepPreviousData: true,
    },
  );

  const events = selectedProject?.settings?.events || {};

  // Max number of events depends on the plan
  const max_nb_events = orgMetadata?.plan === "pro" ? 100 : 10;
  const current_nb_events = Object.keys(events).length;
  let isDisabled = max_nb_events && current_nb_events >= max_nb_events;

  const eventToEdit = {
    project_id: project_id,
    org_id: selectedProject.org_id,
    event_name: cluster.name,
    description: cluster.description,
    score_range_settings: {
      min: 0,
      max: 1,
      score_type: "confidence",
    },
  } as EventDefinition;
  const [sheetEventOpen, setSheetEventOpen] = useState(false);

  return (
    <Card
      key={cluster.id}
      className="rounded-lg shadow-md p-4 flex flex-col justify-between h-full"
    >
      <HoverCard openDelay={0} closeDelay={0}>
        <div className="flex justify-between items-start space-x-2 mb-2">
          <h3 className="text-lg font-semibold text-center">{cluster.name}</h3>
          <HoverCardTrigger asChild>
            <div className="text-xl bg-primary text-secondary rounded-tr-lg px-3">
              {cluster.size}
            </div>
          </HoverCardTrigger>
        </div>
        <HoverCardContent className="text-secondary bg-primary text-xs">
          <p>Cluster size</p>
        </HoverCardContent>
      </HoverCard>
      <p className="text-sm text-muted-foreground mb-4">
        {cluster.description}
      </p>
      <div className="mt-auto pt-2 flex justify-end space-x-2">
        <Sheet
          open={sheetEventOpen}
          onOpenChange={setSheetEventOpen}
          key={cluster.id}
        >
          <SheetTrigger asChild>
            <Button disabled={isDisabled} size="sm" variant="outline">
              <PlusIcon className="h-4 w-4 mr-1" />
              Add tagger
            </Button>
          </SheetTrigger>
          <SheetContent className="md:w-1/2 overflow-auto">
            <CreateEvent
              setOpen={setSheetEventOpen}
              eventToEdit={eventToEdit}
            />
          </SheetContent>
        </Sheet>
        {cluster.size > 5 && (
          <Button
            className="pickaxe-button"
            variant="outline"
            size="sm"
            onClick={(mouseEvent) => {
              mouseEvent.stopPropagation();
              setSheetClusterOpen(true);
              setDataFilters({
                ...dataFilters,
                clustering_id: cluster.clustering_id,
                clusters_ids: [cluster.id],
              });
            }}
          >
            Break down
            <Pickaxe className="w-6 h-6 ml-1 pickaxe-animation" />
          </Button>
        )}
        <Button
          variant="secondary"
          size="sm"
          onClick={(mouseEvent) => {
            mouseEvent.stopPropagation();
            setDataFilters({
              ...dataFilters,
              clustering_id: cluster.clustering_id,
              clusters_ids: [cluster.id],
            });
            router.push(
              `/org/insights/clusters/${encodeURIComponent(cluster.id)}`,
            );
          }}
        >
          Explore
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </Card>
  );
}

export function ClustersCards({
  setSheetClusterOpen: setSheetClusterOpen,
}: {
  setSheetClusterOpen: (value: boolean) => void;
}) {
  const project_id = navigationStateStore((state) => state.project_id);
  const { accessToken } = useUser();

  const { data: clusteringsData } = useSWR(
    project_id ? [`/api/explore/${project_id}/clusterings`, accessToken] : null,
    ([url, accessToken]) => authFetcher(url, accessToken, "POST"),
    {
      keepPreviousData: true,
      revalidateIfStale: false,
    },
  );
  const clusterings = (clusteringsData?.clusterings as Clustering[]) ?? [];

  let latestClustering: Clustering | undefined = undefined;
  if (clusterings.length > 0) {
    console.log("clusterings", clusterings);
    latestClustering = clusterings[0];
  }

  const [selectedClustering, setSelectedClustering] = React.useState<
    Clustering | undefined
  >(latestClustering);

  let selectedClusteringName = selectedClustering?.name;
  if (selectedClustering && !selectedClusteringName) {
    selectedClusteringName = formatUnixTimestampToLiteralDatetime(
      selectedClustering.created_at,
    );
  }

  useEffect(() => {
    setSelectedClustering(latestClustering);
  }, [JSON.stringify(clusterings)]);

  console.log("selectedClustering", selectedClustering);
  console.log("selectedClusteringName", selectedClusteringName);

  const {
    data: clustersData,
  }: {
    data: Cluster[] | null | undefined;
  } = useSWR(
    project_id
      ? [
          `/api/explore/${project_id}/clusters`,
          accessToken,
          selectedClustering?.id,
        ]
      : null,
    ([url, accessToken]) =>
      authFetcher(url, accessToken, "POST", {
        clustering_id: selectedClustering?.id,
        limit: 100,
      }).then((res) =>
        res?.clusters.sort((a: Cluster, b: Cluster) => b.size - a.size),
      ),
    {
      keepPreviousData: true,
    },
  );

  if (!project_id) {
    return <></>;
  }

  return (
    <div>
      <div className="flex flex-row gap-x-2 items-center mb-2 justify-between">
        <div>
          <Select
            onValueChange={(value: string) => {
              if (value === "no-clustering") {
                setSelectedClustering(undefined);
                return;
              }
              setSelectedClustering(
                clusterings.find((clustering) => clustering.id === value),
              );
            }}
            defaultValue={selectedClustering?.id ?? "no-clustering"}
          >
            <SelectTrigger>
              <div>
                {clusterings?.length > 0 && (
                  <span>{selectedClusteringName}</span>
                )}
                {clusterings?.length === 0 && (
                  <span className="text-muted-foreground">
                    No clustering available
                  </span>
                )}
              </div>
            </SelectTrigger>
            <SelectContent className="overflow-y-auto max-h-[20rem]">
              <SelectGroup>
                {clusterings.map((clustering) => (
                  <SelectItem key={clustering.id} value={clustering.id}>
                    {clustering?.name ??
                      formatUnixTimestampToLiteralDatetime(
                        clustering.created_at,
                      )}
                  </SelectItem>
                ))}
                {clusterings.length === 0 && (
                  <SelectItem value="no-clustering">
                    No clustering available
                  </SelectItem>
                )}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
      {!selectedClustering && (
        <div className="w-full text-muted-foreground flex justify-center text-sm h-20">
          Run a clustering to see clusters here.
        </div>
      )}
      {selectedClustering &&
        clustersData?.length === 0 &&
        selectedClustering?.status !== "completed" && (
          <div className="w-full text-muted-foreground flex justify-center text-sm h-20">
            Clustering is in progress...
          </div>
        )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clustersData?.map((cluster) => {
          return (
            <ClusterCard
              key={cluster.id}
              project_id={project_id}
              cluster={cluster}
              setSheetClusterOpen={setSheetClusterOpen}
            />
          );
        })}
      </div>
    </div>
  );
}
