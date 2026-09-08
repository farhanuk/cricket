import { Head, useForm } from "@inertiajs/react";
import type { FormEvent } from "react";
import Heading from "@/components/heading";
import InputError from "@/components/input-error";
import TextLink from "@/components/text-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

export default function FixturesCreate() {
    const form = useForm({
        opponent: "",
        played_at: "",
        venue: "",
        overs: 12,
        balls_per_over: 6,
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();

        form.transform((data) => ({
            ...data,
            played_at: data.played_at || null,
            venue: data.venue || null,
        }));

        form.post("/fixtures");
    };

    return (
        <>
            <Head title="New fixture" />

            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <Heading title="New fixture" />

                <form onSubmit={submit} className="max-w-xl space-y-6">
                    <div className="grid gap-2">
                        <Label htmlFor="opponent">Opponent</Label>
                        <Input
                            id="opponent"
                            value={form.data.opponent}
                            onChange={(event) =>
                                form.setData("opponent", event.target.value)
                            }
                            required
                            placeholder="Opponent team name"
                        />
                        <InputError message={form.errors.opponent} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="played_at">Date</Label>
                        <Input
                            id="played_at"
                            type="date"
                            value={form.data.played_at}
                            onChange={(event) =>
                                form.setData("played_at", event.target.value)
                            }
                        />
                        <InputError message={form.errors.played_at} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="venue">Venue</Label>
                        <Input
                            id="venue"
                            value={form.data.venue}
                            onChange={(event) =>
                                form.setData("venue", event.target.value)
                            }
                            placeholder="Venue name"
                        />
                        <InputError message={form.errors.venue} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="overs">Overs</Label>
                        <Input
                            id="overs"
                            type="number"
                            min={1}
                            max={50}
                            value={form.data.overs}
                            onChange={(event) =>
                                form.setData(
                                    "overs",
                                    Number(event.target.value),
                                )
                            }
                            required
                        />
                        <InputError message={form.errors.overs} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="balls_per_over">Balls per over</Label>
                        <Input
                            id="balls_per_over"
                            type="number"
                            min={1}
                            max={12}
                            value={form.data.balls_per_over}
                            onChange={(event) =>
                                form.setData(
                                    "balls_per_over",
                                    Number(event.target.value),
                                )
                            }
                            required
                        />
                        <InputError message={form.errors.balls_per_over} />
                    </div>

                    <div className="flex items-center gap-4">
                        <Button type="submit" disabled={form.processing}>
                            {form.processing && <Spinner />}
                            Create fixture
                        </Button>
                        <TextLink href="/fixtures">Cancel</TextLink>
                    </div>
                </form>
            </div>
        </>
    );
}

FixturesCreate.layout = {
    breadcrumbs: [
        {
            title: "Fixtures",
            href: "/fixtures",
        },
        {
            title: "New fixture",
            href: "/fixtures/create",
        },
    ],
};
