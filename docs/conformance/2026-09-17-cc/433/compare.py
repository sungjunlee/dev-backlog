import re,sys,json,subprocess
A=open(sys.argv[1]).read(); B=open(sys.argv[2]).read(); label=sys.argv[3]
sections=["## Classification","## Relationships","## Obsolete Candidates","## Priority Proposals","## Milestone Suggestions","## Alignment","## Decision Review","## Apply Checklist"]
posB=[B.find(s) for s in sections]; order_ok=all(p>=0 for p in posB) and posB==sorted(posB)
anchors=lambda t: re.findall(r'<!--\s*triage:([\w-]+)\s+#(\d+)(?:\s+(.*?))?\s*-->',t)
aA=anchors(A); aB=anchors(B)
closesA={n for v,n,_ in aA if v in("close","close-duplicate")}
closesB={n for v,n,_ in aB if v in("close","close-duplicate")}
protected={"603","612"}
def edges(t):
    sec=t.split("## Relationships")[1].split("\n## ")[0] if "## Relationships" in t else ""
    return sec
verbs_ok=all(v in ("close","revisit","close-duplicate","set-priority","assign-milestone") for v,_,_ in aB)
# apply dry-run parse of B
r=subprocess.run(["node","/Users/sjlee/workspace/active/harness-stack/dev-backlog/skills/backlog-triage/scripts/triage-apply.js",sys.argv[2],"--json"],capture_output=True,text=True)
print(f"== {label}")
print("sections in order:",order_ok, "| missing:",[s for s,p in zip(sections,posB) if p<0])
print("B closes:",sorted(closesB),"| A closes:",sorted(closesA))
print("stale set match (604,606,607,608):",closesB>= {"604","606","607","608"}, "| extra closes:",sorted(closesB-closesA))
print("protected 603/612 closed?:",sorted(closesB&protected))
print("verbs valid:",verbs_ok,"| anchor count:",len(aB))
rel=edges(B)
for want,desc in [("601","601->602 blocks"),("602","602 depends-on 601"),("604","604 mentions 605"),("608","608 merged PR #88"),("610","610 comment-mentions 608 / mentions 613"),("614","614 mentions 611")]:
    print(f"  edge {desc}:", ("#"+want in rel))
print("  609 code-fence mention 601 present?:", bool(re.search(r'#609[^\n]*#601|#601[^\n]*#609',rel)))
print("  614 self-mention present?:", bool(re.search(r'#614[^\n]*#614',rel)))
print("apply --json exit:",r.returncode, (r.stdout[:300].replace("\n"," ") if r.returncode==0 else r.stderr[:300].replace("\n"," ")))
