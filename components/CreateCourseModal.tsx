"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export function CreateCourseModal({ onCourseCreated }: { onCourseCreated?: () => void }) {
  const [topic, setTopic] = useState("");
  const [modelName, setModelName] = useState("gemini-2.5-flash");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleCreate = async () => {
    if (!topic.trim()) return;
    setLoading(true);

    try {
      const res = await fetch("/api/generate/course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, modelName }),
      });

      if (!res.ok) {
        throw new Error("Failed to create course");
      }

      const data = await res.json();
      setOpen(false);
      setTopic("");
      
      if (onCourseCreated) onCourseCreated();
      
      // Navigate to the new course viewer
      router.push(`/course/${data.course.id}`);

    } catch (error) {
      console.error(error);
      alert("An error occurred while creating the course.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="w-full sm:w-auto font-semibold">
          Create New Course
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Generate a Podcast Course</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="flex flex-col gap-3">
            <Label htmlFor="topic">What do you want to learn?</Label>
            <Input
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. The History of Rome or Introduction to React"
              className="col-span-3"
            />
          </div>
          <div className="flex flex-col gap-3">
            <Label>Select AI Model</Label>
            <RadioGroup value={modelName} onValueChange={setModelName} className="flex flex-col gap-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="gemini-2.5-flash" id="m-flash" />
                <Label htmlFor="m-flash">Gemini 2.5 Flash (Fast & Free)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="gemini-1.5-pro" id="m-pro" />
                <Label htmlFor="m-pro">Gemini 1.5 Pro (Powerful)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="gpt-4o-mini" id="m-openai" />
                <Label htmlFor="m-openai">GPT-4o Mini (Cost-effective OpenAI)</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleCreate} disabled={loading || !topic.trim()}>
            {loading ? "Generating Outline..." : "Generate Course"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
