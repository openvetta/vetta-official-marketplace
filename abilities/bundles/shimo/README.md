# Shimo integration notes

Shimo is Vetta's immersive bilingual reading workspace. This bundle combines the Shimo reader
plugin (which ships its reading guidance, poetry analysis and reading-record Skills) with the
existing PDF Toolkit.

## Scope

- PDF, Markdown and TXT materials in Chinese, English or mixed language.
- A private copy of every imported material; offline reading of the copy, records and cached pinyin.
- Progressive disclosure: category-aware actions appear after a selection, while the page remains quiet.
- The library starts hidden. Use the Library button in the reading header to show or hide it.
- Reading records open beside the material without an overlay; narrower reading areas stack them below
  the material. Both areas scroll independently. Hide the panel to return the full width to reading.
- Questions and their linked AI answers share a card. New answers open the panel and become visible even
  if a record filter was selected; closing the panel does not interrupt generation or saving.
- Shimo lists the text models already configured in Vetta and stores one explicit reading-model choice.
  Selection actions call that model directly; questions and complete answers are saved as reading records.
- Shimo does not implement a second chat history, queue or streaming protocol.
- PDF highlights, notes, sidecar records and annotated-PDF export are owned by the Shimo plugin.
- OCR is consumed through Vetta's `ocr` protocol and defaults to the host's local Provider.

## Install members

The bundle contains these installable members:

- **Shimo Reader** — the reader workspace, library, selection actions, pinyin, records and export;
  its package includes the Shimo Reading Coach, Poetry Analysis and Reading Records Skills.
- **PDF Toolkit** — the existing PDF-oriented Agent workflow; it is not a dependency of the Shimo reader.

Remote OCR providers are deliberately not bundled. The open-vetta host owns the protocol and
Provider Registry; a future independent plugin may implement a provider or an aggregator. This
marketplace package does not contain a vendor adapter, API key form or real remote OCR call.

## Data and privacy

Import copies bytes into Shimo's private plugin storage. The original path is not required for
normal reading. OCR inputs are opaque handles controlled by Vetta. The built-in local OCR sends no
material over the network. A remote provider, when one is installed in the future, must declare its
permissions, allowed hosts and configuration state; selecting it is an explicit Agent setting.

AI answers are saved automatically. Editing or regenerating creates a new reading-record revision;
it does not overwrite the original answer.
