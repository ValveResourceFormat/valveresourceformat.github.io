fetch( 'https://api.github.com/repositories/42366054/releases/latest' )
	.then( function( response )
	{
		if( !response.ok )
		{
			throw new Error( 'Failed to fetch github release' );
		}

		return response.json();
	} )
	.then( function( response )
	{
		for( const asset of response.assets )
		{
			if( asset.name === 'Source2Viewer.exe' )
			{
				document.getElementById( 'js-download' ).href = asset.browser_download_url;
				document.getElementById( 'js-download-header' ).href = asset.browser_download_url;

				const version = document.querySelector( '.download-version' );
				version.href = response.html_url;

				let string = `View release notes for v${response.tag_name}`;

				if( window.innerWidth > 500 )
				{
					const date = new Date( response.published_at );
					string += `, released on ${date.toLocaleDateString()}`;
				}

				version.textContent = string;

				break;
			}
		}
	} );

function LoadWorkshop()
{
	fetch( 'https://steamdb.info/api/Source2ViewerWorkshop/' )
		.then( function( response )
		{
			if( !response.ok )
			{
				throw new Error( 'Failed to fetch workshop items' );
			}

			return response.json();
		} )
		.then( function( response )
		{
			if( !response.success || !response.data )
			{
				throw new Error( 'Failed to fetch workshop items' );
			}

			const dateFormatter = new Intl.DateTimeFormat(undefined, {
				dateStyle: 'medium',
			});

			const dom = document.querySelectorAll( '.workshop-item' );

			for( let i = 0; i < response.data.length && i < dom.length; i++ )
			{
				const file = response.data[ i ];
				const element = dom[ i ];
				const date = new Date( file.time_created * 1000 );

				const params = new URLSearchParams();
				params.set( 'id', file.id );
				params.set( 'utm_source', 'Source 2 Viewer' );
				params.set( 'searchtext', 'valveresourceformat' );

				element.href = `https://steamcommunity.com/sharedfiles/filedetails/?${params}`;
				element.querySelector( '.workshop-image' ).src = file.preview_url;
				element.querySelector( '.workshop-title' ).textContent = file.title;
				element.querySelector( '.workshop-info' ).textContent = `${dateFormatter.format(date)} — ${file.subscriptions.toLocaleString()} subscribers`;
			}
		} );
}

if( 'IntersectionObserver' in window )
{
	const observer = new window.IntersectionObserver( entries =>
	{
		entries.forEach( entry =>
		{
			if( entry.isIntersecting )
			{
				observer.disconnect();
				LoadWorkshop();
			}
		} );
	}, {
		rootMargin: '200px 0px 0px 0px'
	} );
	observer.observe( document.querySelector( '.workshop' ) );
}
else
{
	LoadWorkshop();
}
