from groq import Groq
from dotenv import load_dotenv
import os

load_dotenv() # take environment variables from .env file
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def get_reply(user_message: str, system_prompt: str = "You are a helpful assistant.") -> str:
    """
    Send user_message to Groq and return the assistant reply string.
    """
    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ]
    )

    # response.choices[0].message is an object — access .content
    choice = response.choices[0]
    msg = choice.message
    # safe access
    if hasattr(msg, "content"):
        return msg.content.strip()
    # fallback: try stringification
    return str(msg)